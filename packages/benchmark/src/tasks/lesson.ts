import {
  Lesson,
  LessonModule,
  lessonContentHash,
  newId,
  type AudienceBand,
  type ReadingLevel,
} from "@sbi/contracts";
import type { LlmProvider } from "@sbi/llm";
import { z } from "zod";
import type { SeedPrompt } from "../seed-set";

type ReadingLevelValue = z.infer<typeof ReadingLevel>;

export const LESSON_PROMPT_VERSION = "lesson-p0.2";

const DraftClaim = z.object({
  claimId: z.string(),
  text: z.string(),
  status: z.enum(["supported", "qualified", "disputed", "unsupported"]),
  confidence: z.enum(["high", "medium", "low"]),
  sourceIds: z.array(z.string()),
  uncertainty: z.string().nullable(),
});

export const LessonDraft = z.object({
  title: z.string(),
  summary: z.string(),
  learningObjectives: z.array(z.string()),
  misconceptionNotes: z.array(z.string()),
  concepts: z.array(z.object({ conceptId: z.string(), label: z.string() })),
  steps: z.array(
    z.object({
      module: LessonModule,
      title: z.string(),
      text: z.string(),
      guess: z
        .object({
          question: z.string(),
          options: z.array(z.string()),
          answer: z.int(),
          why: z.string(),
        })
        .nullable(),
      claimIds: z.array(z.string()),
    }),
  ),
  claims: z.array(DraftClaim),
  sources: z.array(z.object({ sourceId: z.string(), title: z.string(), url: z.string() })),
});

export type LessonDraft = z.infer<typeof LessonDraft>;

const strictObject = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const strings = { type: "array", items: { type: "string" } };

export const LESSON_DRAFT_SCHEMA = strictObject({
  title: { type: "string" },
  summary: { type: "string" },
  learningObjectives: strings,
  misconceptionNotes: strings,
  concepts: {
    type: "array",
    items: strictObject({ conceptId: { type: "string" }, label: { type: "string" } }),
  },
  steps: {
    type: "array",
    items: strictObject({
      module: { type: "string", enum: LessonModule.options },
      title: { type: "string" },
      text: { type: "string" },
      guess: {
        ...strictObject({
          question: { type: "string" },
          options: strings,
          answer: { type: "integer" },
          why: { type: "string" },
        }),
        type: ["object", "null"],
      },
      claimIds: strings,
    }),
  },
  claims: {
    type: "array",
    items: strictObject({
      claimId: { type: "string" },
      text: { type: "string" },
      status: { type: "string", enum: ["supported", "qualified", "disputed", "unsupported"] },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      sourceIds: strings,
      uncertainty: { type: ["string", "null"] },
    }),
  },
  sources: {
    type: "array",
    items: strictObject({
      sourceId: { type: "string" },
      title: { type: "string" },
      url: { type: "string" },
    }),
  },
});

const READING_LEVEL: Record<AudienceBand, ReadingLevelValue> = {
  child: "simple",
  teen: "plain",
  adult: "plain",
  general: "plain",
};

// Mirrors the prototype's live lesson prompt: the short answer first, then a chain that derives it.
const SYSTEM_PROMPT = `You write short, accurate science lessons about everyday objects. Lessons teach from first principles: the learner should be able to rebuild the answer from basic truths, not just remember it.
Write 8 to 12 steps, each tagged with a module from: ${LessonModule.options.join(", ")}. In order:
1. "what-youre-seeing": what's in front of the learner, ending on the puzzle the question raises.
2. "short-answer": the answer in 1-2 sentences.
3. "first-principles", 1-2 steps: basic truths the learner can check or already trusts (e.g. energy isn't created, matter is made of moving particles). Explain any jargon.
4. "how-parts-work", 2-4 steps: reason from those truths through the object's parts to the answer, one small inference per step. Title the last one "Put it together"; it restates the answer as the conclusion of the chain.
5. "try-an-idea": a safe experiment that tests the reasoning. 6. "check-thinking": apply the idea to a new situation. 7. "history": how someone first worked it out. 8. "go-further".
Give most reasoning steps, and the check-thinking step, a guess: a question the learner can work out from the steps so far, 2-3 options, answer as the 0-based index, and why. guess is null elsewhere.
Every factual statement belongs to a claim. Each claim cites sourceIds from your sources list; use only real, well-known reference pages (encyclopedias, textbooks, institutions) whose URL you are confident exists.
If you are not sure a claim is supported, mark it "qualified" or "unsupported" and explain in uncertainty; otherwise set uncertainty to null.
The "history" step must cite at least one claim. If the question contains a misconception, correct it kindly and record it in misconceptionNotes.
Use ids made of letters, digits and dashes.`;

export function lessonMessages(prompt: SeedPrompt) {
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: `Object: ${prompt.label}\nLearner question: ${prompt.question}\nAudience: ${prompt.audience}, reading level ${READING_LEVEL[prompt.audience]}.`,
    },
  ];
}

export async function generateDraft(llm: LlmProvider, prompt: SeedPrompt) {
  const completion = await llm.complete({
    messages: lessonMessages(prompt),
    jsonSchema: { name: "LessonDraft", schema: LESSON_DRAFT_SCHEMA },
    maxTokens: 8000,
  });
  return { completion, draft: LessonDraft.parse(JSON.parse(completion.text)) };
}

type DraftStep = LessonDraft["steps"][number];

// The contract allows one section per module, so a module's steps are joined in order.
export function stepsToSections(steps: DraftStep[]) {
  const sections = new Map<
    string,
    { module: DraftStep["module"]; parts: string[]; claimIds: string[] }
  >();
  for (const step of steps) {
    const section = sections.get(step.module) ?? { module: step.module, parts: [], claimIds: [] };
    const guess = step.guess ? ` ${step.guess.question} ${step.guess.why}` : "";
    section.parts.push(`${step.title}: ${step.text}${guess}`);
    section.claimIds.push(...step.claimIds.filter((id) => !section.claimIds.includes(id)));
    sections.set(step.module, section);
  }
  return [...sections.values()].map(({ module, parts, claimIds }) => ({
    module,
    text: parts.join("\n\n"),
    claimIds,
  }));
}

/** Wraps a model draft in lesson metadata so it can be checked against the Lesson contract. */
export async function draftToLesson(
  draft: LessonDraft,
  prompt: SeedPrompt,
  meta: { provider: string; model: string; generatedAt: string },
): Promise<unknown> {
  // Models write readable ids; the contract wants UUIDs, so map each one consistently.
  const uuids = new Map<string, string>();
  const uuidFor = (id: string) => uuids.get(id) ?? uuids.set(id, newId()).get(id) ?? "";
  const lesson = {
    lessonId: newId(),
    version: 1,
    taxonomyId: prompt.taxonomyId,
    title: draft.title,
    locale: "en",
    audience: [prompt.audience],
    readingLevel: READING_LEVEL[prompt.audience],
    summary: draft.summary,
    learningObjectives: draft.learningObjectives,
    assumptions: [],
    concepts: draft.concepts.map((concept) => ({ ...concept, prerequisites: [] })),
    misconceptionNotes: draft.misconceptionNotes,
    sections: stepsToSections(draft.steps).map((section, index) => ({
      sectionId: `s${index + 1}`,
      ...section,
      claimIds: section.claimIds.map(uuidFor),
    })),
    claims: draft.claims.map(({ uncertainty, claimId, sourceIds, ...claim }) => ({
      ...claim,
      claimId: uuidFor(claimId),
      sourceIds: sourceIds.map((id) => uuidFor(`source:${id}`)),
      scope: prompt.label,
      dependsOn: [],
      ...(uncertainty ? { uncertainty } : {}),
    })),
    visuals: [],
    safetyClass: "low",
    reviewStatus: "generated",
    reuse: {
      intentSignature: `${prompt.taxonomyId}:${prompt.id}`,
      cacheScope: "private",
      generatedAt: meta.generatedAt,
      evidenceSnapshotId: newId(),
      sourceFreshness: "unknown",
      modelVersion: meta.model,
      promptVersion: LESSON_PROMPT_VERSION,
      policyVersion: "p0",
      contentHash: "0".repeat(64),
    },
  };
  lesson.reuse.contentHash = await lessonContentHash(lesson as unknown as Lesson);
  return lesson;
}

export interface LessonScore {
  schemaValid: boolean;
  issues: string[];
  modulesCovered: number;
  allSourcesCited: boolean;
  /** Short answer second, basic truths before parts, at least 3 reasoning steps ending on "Put it together". */
  derivesAnswer: boolean;
  guesses: number;
  guessesValid: boolean;
}

const REASONING = new Set(["first-principles", "how-parts-work"]);

export function scoreLesson(draft: LessonDraft, lesson: unknown): LessonScore {
  const parsed = Lesson.safeParse(lesson);
  const sourceIds = new Set(draft.sources.map((source) => source.sourceId));
  const modules = draft.steps.map((step) => step.module);
  const reasoning = draft.steps.filter((step) => REASONING.has(step.module));
  const firstPart = modules.indexOf("how-parts-work");
  const guesses = draft.steps.flatMap((step) => step.guess ?? []);
  return {
    schemaValid: parsed.success,
    issues: parsed.success ? [] : parsed.error.issues.slice(0, 5).map((issue) => issue.message),
    modulesCovered: new Set(modules).size,
    allSourcesCited: draft.claims.every((claim) =>
      claim.sourceIds.every((id) => sourceIds.has(id)),
    ),
    derivesAnswer:
      modules.indexOf("short-answer") === 1 &&
      firstPart > modules.indexOf("first-principles") &&
      modules.indexOf("first-principles") > 1 &&
      reasoning.length >= 3 &&
      /put it together/i.test(reasoning.at(-1)?.title ?? ""),
    guesses: guesses.length,
    guessesValid: guesses.every(
      (guess) => guess.options.length >= 2 && guess.options[guess.answer] !== undefined,
    ),
  };
}
