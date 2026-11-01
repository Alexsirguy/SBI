import { VisualAsset } from "@sbi/contracts";
import { LlmError, type CompletionRequest, type LlmProvider } from "@sbi/llm";
import { describe, expect, it, vi } from "vitest";
import { compileFormula } from "./formula";
import {
  GENERATED_VISUAL_SCHEMA,
  PITCH_EXAMPLE,
  VISUAL_PROMPT,
  VISUAL_SYSTEM_PROMPT,
  type GeneratedVisual,
} from "./generate";
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

const EXPERIMENT = {
  controls: [{ id: "tension", label: "Tension", unit: "N", min: 40, max: 200, value: 110 }],
  readouts: [{ id: "pitch", label: "Pitch", unit: "Hz" }],
};

const guitar = {
  ...lesson,
  title: "Why a tighter string sounds higher",
  summary: "Pitch rises with tension.",
  experiment: EXPERIMENT,
};

const PITCH_GRAPH: GeneratedVisual = {
  ...EMPTY,
  kind: "graph",
  alt: "Pitch against string length",
  fallbackText: "A shorter or tighter string sounds higher.",
  controls: [
    { id: "tension", label: "Tension", unit: "N", min: 50, max: 150, step: 1, value: 100 },
  ],
  readouts: [
    { id: "pitch", label: "Pitch", unit: "Hz", formula: "sqrt(tension / 0.0055) / (2 * 0.65)" },
  ],
  graph: {
    x: { name: "length", label: "String length", unit: "m", from: 0.3, to: 0.9 },
    series: [
      { name: "f", label: "Pitch", unit: "Hz", formula: "sqrt(tension / 0.0055) / (2 * length)" },
    ],
    mark: "line",
  },
};

describe("generateVisual with the lesson's experiment", () => {
  it("asks for the experiment's ids and gives its controls the experiment's range and start", async () => {
    const { provider, requests } = scripted(PITCH_GRAPH);
    const result = await generateVisual({ provider, lesson: guitar, pubchem });
    if (!result || !("manifest" in result)) throw new Error(JSON.stringify(result));
    const user = String(requests[0]?.messages[1]?.content);
    expect(user).toContain("- control tension (Tension, N): min 40, max 200, value 110");
    expect(user).toContain("- readout pitch (Pitch, Hz)");
    expect(result.manifest.controls[0]).toMatchObject({
      id: "tension",
      min: 40,
      max: 200,
      value: 110,
    });
    expect(result.missing).toEqual([]);
    expect(result.attempts).toBe(1);
  });

  it("sends a missing experiment id back for repair", async () => {
    const missing = { ...PITCH_GRAPH, readouts: [{ ...PITCH_GRAPH.readouts[0], id: "frequency" }] };
    const { provider, requests } = scripted(missing, PITCH_GRAPH);
    const result = await generateVisual({ provider, lesson: guitar, pubchem });
    expect(result && "manifest" in result && result.attempts).toBe(2);
    expect(String(requests[1]?.messages.at(-1)?.content)).toContain(
      'add a readout with id "pitch"',
    );
  });

  it("keeps a picture that still misses experiment ids after the repair", async () => {
    const missing = {
      ...PITCH_GRAPH,
      controls: [{ ...PITCH_GRAPH.controls[0], id: "pull" }],
      readouts: [{ ...PITCH_GRAPH.readouts[0], formula: "sqrt(pull / 0.0055) / 1.3" }],
      graph: {
        ...PITCH_GRAPH.graph,
        series: [{ ...PITCH_GRAPH.graph.series[0], formula: "sqrt(pull / 0.0055) / (2 * length)" }],
      },
    } as GeneratedVisual;
    const { provider } = scripted(missing, missing);
    const result = await generateVisual({ provider, lesson: guitar, pubchem });
    if (!result || !("manifest" in result)) throw new Error(JSON.stringify(result));
    expect(result.attempts).toBe(2);
    expect(result.missing).toEqual([expect.stringContaining('control with id "tension"')]);
    expect(result.manifest.controls.map((control) => control.id)).toEqual(["pull"]);
  });

  it("keeps the first picture when the repair comes back broken", async () => {
    const missing = { ...PITCH_GRAPH, readouts: [{ ...PITCH_GRAPH.readouts[0], id: "frequency" }] };
    const broken = { ...PITCH_GRAPH, readouts: [{ ...PITCH_GRAPH.readouts[0], formula: "nope(" }] };
    const { provider } = scripted(missing, broken);
    const result = await generateVisual({ provider, lesson: guitar, pubchem });
    if (!result || !("manifest" in result)) throw new Error(JSON.stringify(result));
    expect(result.manifest.readouts.map((readout) => readout.id)).toEqual(["frequency"]);
  });

  it("asks nothing of a process, which has no sliders", async () => {
    const { provider } = scripted(PROCESS);
    const result = await generateVisual({
      provider,
      lesson: { ...lesson, experiment: EXPERIMENT },
      pubchem,
    });
    expect(result && "manifest" in result && result.missing).toEqual([]);
  });
});

describe("visual prompt", () => {
  it("asks for the experiment's ids in every kind with sliders, under v7", () => {
    expect(VISUAL_PROMPT.version).toBe("v8");
    expect(VISUAL_SYSTEM_PROMPT).toContain("SAME id, min, max and value");
    expect(VISUAL_SYSTEM_PROMPT).toContain("except molecule, process and none");
  });

  it("tries the kinds with sliders before the playground", () => {
    expect(VISUAL_SYSTEM_PROMPT).toContain("mechanism, graph, molecule, process, playground");
    expect(VISUAL_SYSTEM_PROMPT).toContain(PITCH_EXAMPLE.series[0]?.formula);
  });

  it("teaches a pitch graph with the right physics", () => {
    const formula = compileFormula(PITCH_EXAMPLE.series[0]?.formula ?? "", [
      "length",
      "tension",
      "massPerMetre",
    ]);
    if ("error" in formula) throw new Error(formula.error);
    // A guitar's open A string: 0.65 m, 112.5 N and 0.0055 kg/m sounds at about 110 Hz.
    expect(formula.evaluate({ length: 0.65, tension: 112.5, massPerMetre: 0.0055 })).toBeCloseTo(
      110,
      0,
    );
  });
});
