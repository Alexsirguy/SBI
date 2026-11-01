import { VisualManifest, type VisualAsset } from "@sbi/contracts";
import { completeStructured, LlmError, type ChatMessage, type LlmProvider } from "@sbi/llm";
import { ZodError } from "zod";
import type { MainModule } from "@mujoco/mujoco";
import type mermaidApi from "mermaid";
import { commonLayerProblems } from "./common/validate";
import { experimentProblems } from "./experiment";
import {
  diagramStages,
  MIN_DIAGRAM_STAGES,
  DIAGRAM_PROMPT,
  DIAGRAM_SYSTEM_PROMPT,
  GENERATED_DIAGRAM_SCHEMA,
  GENERATED_VISUAL_SCHEMA,
  GeneratedVisual,
  PLAYGROUND_REVIEW_PROMPT,
  PLAYGROUND_REVIEW_SCHEMA,
  PlaygroundReview,
  playgroundReviewMessages,
  generatedSpecAsset,
  toManifest,
  VISUAL_PROMPT,
  VISUAL_SYSTEM_PROMPT,
  visualUserPrompt,
  type LessonForVisual,
} from "./generate";
import { graphProblems, graphRows, planGraph, vegaLiteSpec } from "./kinds/graph-spec";
import { physicsProblems, readMechanismSpec } from "./kinds/mechanism-sim";
import { readMoleculeSpec } from "./kinds/molecule-spec";
import { PlaygroundSpec, playgroundCodeProblems } from "./kinds/playground-spec";
import { processSpecProblems } from "./kinds/process-spec";
import { resolveMolecules, type PubChemCache } from "./pubchem";

type Mermaid = typeof mermaidApi;
let mermaid: Promise<Mermaid> | undefined;
let mujoco: Promise<MainModule> | undefined;

// Mermaid parses through DOMPurify, which needs a window; happy-dom gives it one outside a browser.
async function loadMermaid(): Promise<Mermaid> {
  mermaid ??= (async () => {
    const { Window } = await import("happy-dom");
    const window = new Window();
    Object.assign(globalThis, { window, document: window.document });
    return (await import("mermaid")).default;
  })();
  return mermaid;
}

async function kindProblems(manifest: VisualManifest): Promise<string[]> {
  switch (manifest.kind) {
    case "process": {
      const problems = processSpecProblems(manifest.spec);
      if (problems.length > 0) return problems;
      try {
        await (await loadMermaid()).parse(String(manifest.spec));
        return [];
      } catch (error) {
        return [`Mermaid could not read the diagram: ${(error as Error).message}`];
      }
    }
    case "graph": {
      const problems = graphProblems(manifest);
      if (problems.length > 0) return problems;
      const plan = planGraph(manifest);
      if ("problems" in plan) return plan.problems;
      const { compile } = await import("vega-lite");
      const values = Object.fromEntries(manifest.controls.map((c) => [c.id, c.value]));
      try {
        compile({
          ...vegaLiteSpec(plan, manifest.alt),
          data: { values: graphRows(plan, values) },
        } as never);
        return [];
      } catch (error) {
        return [`Vega-Lite could not read the graph: ${(error as Error).message}`];
      }
    }
    case "mechanism": {
      const spec = readMechanismSpec(manifest);
      if ("problems" in spec) return spec.problems;
      const { default: loadMujoco } = await import("@mujoco/mujoco");
      mujoco ??= loadMujoco();
      return physicsProblems(await mujoco, manifest);
    }
    case "molecule": {
      const spec = readMoleculeSpec(manifest);
      return "problems" in spec ? spec.problems : [];
    }
    case "playground": {
      const spec = PlaygroundSpec.safeParse(manifest.spec);
      if (!spec.success) return ["spec.code: write the playground's code"];
      return playgroundCodeProblems(spec.data.code);
    }
  }
}

/** Everything wrong with a generated manifest, worded for the AI's one repair attempt (ADR 0014). */
export async function manifestProblems(input: unknown): Promise<string[]> {
  const parsed = VisualManifest.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "manifest"}: ${issue.message}`,
    );
  }
  return [...commonLayerProblems(parsed.data), ...(await kindProblems(parsed.data))];
}

export { memoryPubChemCache, resolveMolecules, type PubChemCache } from "./pubchem";
export { type LessonForVisual } from "./generate";

export interface GeneratedResult {
  manifest: VisualManifest;
  /** Rights records for the spec and any PubChem structures; save them before the lesson shows it. */
  assets: VisualAsset[];
  attempts: number;
  /** Experiment ids still missing after the repair; the lesson's tasks then fall back to choices. */
  missing: string[];
}

/**
 * Asks the AI for one visual and checks it; problems go back once for repair (ADR 0014).
 * Resolves to undefined when the AI says no picture would help.
 */
export async function generateVisual(input: {
  provider: LlmProvider;
  lesson: LessonForVisual;
  pubchem: { cache: PubChemCache; fetch?: typeof fetch };
  signal?: AbortSignal;
  /** "diagram" asks only for a stage diagram beside the experiment, or none (ADR 0017). */
  mode?: "experiment" | "diagram";
}): Promise<GeneratedResult | { problems: string[]; attempts: number } | undefined> {
  const diagram = input.mode === "diagram";
  // A diagram has no sliders, so it never sees the experiment it could not offer.
  const lesson = diagram ? { ...input.lesson, experiment: undefined } : input.lesson;
  input = { ...input, lesson };
  const messages: ChatMessage[] = [
    { role: "system", content: diagram ? DIAGRAM_SYSTEM_PROMPT : VISUAL_SYSTEM_PROMPT },
    { role: "user", content: visualUserPrompt(lesson) },
  ];
  let problems: string[] = [];
  // A picture that misses only experiment ids is still worth showing if the repair does no better.
  let kept: GeneratedResult | undefined;
  const sendBack = (answer: string) =>
    messages.push(
      { role: "assistant", content: answer },
      {
        role: "user",
        content: `That picture cannot be shown yet. Fix these problems and answer again in full:\n${problems.map((p) => `- ${p}`).join("\n")}`,
      },
    );
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const answer = await completeStructured(input.provider, {
      messages,
      jsonSchema: {
        name: "Visual",
        schema: diagram ? GENERATED_DIAGRAM_SCHEMA : GENERATED_VISUAL_SCHEMA,
      },
      maxTokens: 8000,
      prompt: diagram ? DIAGRAM_PROMPT : VISUAL_PROMPT,
      signal: input.signal,
      parse: (text) => GeneratedVisual.parse(JSON.parse(text)),
    }).catch((error: unknown) => {
      if (kept && error instanceof LlmError) return undefined;
      throw error;
    });
    if (!answer) break;
    const { value, completion } = answer;
    if (diagram) {
      // A process topic with its stages decides, not the kind alone, so those get one reliably.
      const stages = diagramStages(completion.text);
      if (stages.length < MIN_DIAGRAM_STAGES) return undefined;
      if (value.kind === "none") {
        problems = [
          `You listed ${stages.length} stages, so draw them: kind "process", one node per stage, in order.`,
        ];
        sendBack(completion.text);
        continue;
      }
    }
    const checked = await check(value, input);
    if (checked === undefined) return kept && { ...kept, attempts: attempt };
    if ("manifest" in checked) {
      if (checked.missing.length === 0) return { ...checked, attempts: attempt };
      if (!kept || checked.missing.length <= kept.missing.length)
        kept = { ...checked, attempts: attempt };
      problems = checked.missing;
    } else {
      problems = checked.problems;
    }
    sendBack(completion.text);
  }
  return kept ? { ...kept, attempts: 2 } : { problems, attempts: 2 };
}

interface CheckInput {
  provider: LlmProvider;
  lesson: LessonForVisual;
  pubchem: { cache: PubChemCache; fetch?: typeof fetch };
  signal?: AbortSignal;
}

async function reviewPlayground(input: CheckInput, manifest: VisualManifest): Promise<string[]> {
  const request = {
    messages: playgroundReviewMessages(
      input.lesson,
      manifest,
      String((manifest.spec as { code?: unknown }).code),
    ),
    jsonSchema: { name: "PlaygroundReview", schema: PLAYGROUND_REVIEW_SCHEMA },
    // Room for the model to reason before it answers; a tight cap came back empty in live runs.
    maxTokens: 6000,
    prompt: PLAYGROUND_REVIEW_PROMPT,
    signal: input.signal,
    parse: (text: string) => PlaygroundReview.parse(JSON.parse(text)),
  };
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const { value } = await completeStructured(input.provider, request);
      return value.problems.filter((problem) => problem.trim() !== "").slice(0, 6);
    } catch (error) {
      if (!(error instanceof LlmError) || attempt === 2) break;
    }
  }
  // The review is a second opinion: code that passed the sandbox checks still ships without it.
  return [];
}

async function check(
  output: GeneratedVisual,
  input: CheckInput,
): Promise<
  | { manifest: VisualManifest; assets: VisualAsset[]; missing: string[] }
  | { problems: string[] }
  | undefined
> {
  let manifest: VisualManifest | undefined;
  try {
    manifest = toManifest(output, input.lesson);
  } catch (error) {
    const issues = error instanceof ZodError ? error.issues : [];
    return {
      problems: issues.length
        ? issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        : [String(error)],
    };
  }
  if (!manifest) return undefined;
  let assets: VisualAsset[] = [];
  if (manifest.kind === "molecule") {
    const resolved = await resolveMolecules(manifest, input.pubchem);
    if ("problems" in resolved) return resolved;
    ({ manifest, assets } = resolved);
  }
  const missing = experimentProblems(manifest, input.lesson.experiment);
  const problems = await manifestProblems(manifest);
  if (problems.length > 0) return { problems: [...problems, ...missing] };
  if (manifest.kind === "playground") {
    const review = await reviewPlayground(input, manifest);
    if (review.length > 0) return { problems: [...review, ...missing] };
  }
  const own = await generatedSpecAsset(manifest, input.lesson.lessonId);
  return {
    manifest: { ...manifest, assetIds: [own.assetId, ...manifest.assetIds] },
    assets: [own, ...assets],
    missing,
  };
}
