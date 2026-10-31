import { VisualAsset } from "@sbi/contracts";
import { LlmError, type CompletionRequest, type LlmProvider } from "@sbi/llm";
import { describe, expect, it, vi } from "vitest";
import { GENERATED_VISUAL_SCHEMA, type GeneratedVisual } from "./generate";
import { memoryPubChemCache } from "./pubchem";
import { generateVisual } from "./server";

const CLAIM = "0192f1a0-0000-7000-8000-000000000301";
const OTHER = "0192f1a0-0000-7000-8000-000000000399";

const lesson = {
  lessonId: "0192f1a0-0000-7000-8000-000000000300",
  title: "How leaves make food",
  summary: "Leaves use light to make sugar.",
  readingLevel: "plain",
  claims: [{ claimId: CLAIM, text: "Chloroplasts capture light energy." }],
};

const EMPTY: GeneratedVisual = {
  kind: "none",
  alt: "",
  longDescription: "",
  fallbackText: "",
  assumptions: [],
  labels: [],
  controls: [],
  readouts: [],
  mjcf: "",
  bindings: [],
  mermaid: "",
  graph: { x: { name: "x", label: "", unit: "", from: 0, to: 1 }, series: [], mark: "line" },
  molecules: [],
  code: "",
};

const PROCESS: GeneratedVisual = {
  ...EMPTY,
  kind: "process",
  alt: "Photosynthesis: light, water and carbon dioxide become sugar",
  longDescription: "Light, water and carbon dioxide go into the leaf; sugar and oxygen come out.",
  fallbackText: "Leaves make sugar from light, water and carbon dioxide.",
  labels: [
    { id: "chloroplast", text: "Chloroplast", claimId: CLAIM },
    { id: "stoma", text: "Stoma", claimId: OTHER },
    { id: "chloroplast", text: "Chloroplast again", claimId: CLAIM },
  ],
  mermaid: "flowchart LR\n  light[Light] --> leaf[Leaf]\n  leaf --> sugar[Sugar]",
};

function scripted(...answers: unknown[]) {
  const requests: CompletionRequest[] = [];
  const provider: LlmProvider = {
    id: "test",
    model: "test",
    complete: vi.fn(async (request: CompletionRequest) => {
      requests.push(structuredClone({ ...request, signal: undefined }));
      const answer = answers[requests.length - 1] ?? EMPTY;
      return {
        text: JSON.stringify(answer),
        model: "test",
        latencyMs: 1,
        usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
      };
    }),
  };
  return { provider, requests };
}

const pubchem = {
  cache: memoryPubChemCache(),
  fetch: vi.fn(async () => new Response("", { status: 404 })),
};

describe("generateVisual", () => {
  it("returns a checked manifest with our own rights record, dropping repeated labels and foreign claims", async () => {
    const { provider, requests } = scripted(PROCESS);
    const result = await generateVisual({ provider, lesson, pubchem });
    if (!result || !("manifest" in result)) throw new Error(JSON.stringify(result));
    expect(result.attempts).toBe(1);
    expect(result.manifest.labels.map((label) => label.id)).toEqual(["chloroplast"]);
    const [own] = result.assets;
    expect(VisualAsset.parse(own).approvedLessonIds).toEqual([lesson.lessonId]);
    expect(result.manifest.assetIds).toEqual([own?.assetId]);
    expect(requests[0]?.jsonSchema?.schema).toEqual(GENERATED_VISUAL_SCHEMA);
    expect(String(requests[0]?.messages[1]?.content)).toContain(CLAIM);
  });

  it("sends problems back once and accepts the repaired answer", async () => {
    const broken = { ...PROCESS, mermaid: "flowchart LR\n  A[Light --> " };
    const { provider, requests } = scripted(broken, PROCESS);
    const result = await generateVisual({ provider, lesson, pubchem });
    expect(result && "manifest" in result && result.attempts).toBe(2);
    expect(String(requests[1]?.messages.at(-1)?.content)).toMatch(
      /Mermaid could not read the diagram/,
    );
  });

  it("gives up after the repair also fails", async () => {
    const broken = { ...PROCESS, mermaid: 'pie\n  "a": 1' };
    const { provider } = scripted(broken, broken);
    const result = await generateVisual({ provider, lesson, pubchem });
    expect(result).toMatchObject({
      attempts: 2,
      problems: [expect.stringMatching(/must start with/)],
    });
  });

  it("reports a contract problem, such as a slider whose value is out of range, for repair", async () => {
    const graph: GeneratedVisual = {
      ...EMPTY,
      kind: "graph",
      alt: "Sugar made over a day",
      fallbackText: "More light makes more sugar.",
      controls: [
        { id: "light", label: "Light", unit: "%", min: 0, max: 100, step: 10, value: 150 },
      ],
      graph: {
        x: { name: "hour", label: "Hour", unit: "h", from: 0, to: 24 },
        series: [{ name: "sugar", label: "Sugar", unit: "g", formula: "light * hour / 100" }],
        mark: "line",
      },
    };
    const { provider, requests } = scripted(graph, {
      ...graph,
      controls: graph.controls.map((control) => ({ ...control, value: 50 })),
    });
    const result = await generateVisual({ provider, lesson, pubchem });
    expect(result && "manifest" in result).toBe(true);
    expect(String(requests[1]?.messages.at(-1)?.content)).toMatch(/controls\.0\.value/);
  });

  it("returns nothing when the AI says no picture would help", async () => {
    const { provider } = scripted(EMPTY);
    expect(await generateVisual({ provider, lesson, pubchem })).toBeUndefined();
  });

  it("passes PubChem's answer back when it does not know a molecule", async () => {
    const molecule = {
      ...EMPTY,
      kind: "molecule" as const,
      alt: "Glucose",
      fallbackText: "Sugar.",
      molecules: [{ name: "leafium", caption: "" }],
    };
    const { provider, requests } = scripted(molecule, molecule);
    await generateVisual({ provider, lesson, pubchem });
    expect(String(requests[1]?.messages.at(-1)?.content)).toMatch(
      /PubChem does not know a molecule called "leafium"/,
    );
  });

  it("has playground code reviewed against the lesson, and sends the review's problems back", async () => {
    const { RAINBOW_CODE } = await import("./kinds/rainbow");
    const playground: GeneratedVisual = {
      ...EMPTY,
      kind: "playground",
      alt: "Light splitting in a raindrop",
      fallbackText: "Each colour bends a little differently.",
      controls: [{ id: "spread", label: "Spread", unit: "×", min: 1, max: 6, step: 1, value: 1 }],
      code: RAINBOW_CODE,
    };
    const { provider, requests } = scripted(
      playground,
      { problems: ["violet is drawn bending less than red"] },
      playground,
      { problems: [] },
    );
    const result = await generateVisual({ provider, lesson, pubchem });
    expect(result && "manifest" in result && result.attempts).toBe(2);
    expect(requests[1]?.prompt?.id).toBe("visual-playground-review");
    expect(String(requests[2]?.messages.at(-1)?.content)).toMatch(/violet is drawn bending less/);
  });

  it("sends forbidden playground code back before any review", async () => {
    const leaky = {
      ...EMPTY,
      kind: "playground" as const,
      alt: "x",
      fallbackText: "y",
      code: "fetch('https://x.example'); kit.onFrame(() => {});",
    };
    const { provider, requests } = scripted(leaky, leaky);
    const result = await generateVisual({ provider, lesson, pubchem });
    expect(result).toMatchObject({ problems: [expect.stringMatching(/may not use fetch/)] });
    expect(requests.every((request) => request.prompt?.id === "visual-generate")).toBe(true);
  });

  it("ships playground code that passed the sandbox checks when the review never answers", async () => {
    const { RAINBOW_CODE } = await import("./kinds/rainbow");
    const playground: GeneratedVisual = {
      ...EMPTY,
      kind: "playground",
      alt: "Light splitting in a raindrop",
      fallbackText: "Each colour bends a little differently.",
      code: RAINBOW_CODE,
    };
    let calls = 0;
    const provider: LlmProvider = {
      id: "test",
      model: "test",
      complete: async () => {
        calls += 1;
        if (calls > 1) throw new LlmError("test: empty completion");
        return {
          text: JSON.stringify(playground),
          model: "test",
          latencyMs: 1,
          usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
        };
      },
    };
    const result = await generateVisual({ provider, lesson, pubchem });
    expect(result && "manifest" in result).toBe(true);
    expect(calls).toBe(3);
  });
});
