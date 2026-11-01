import { join } from "node:path";
import { Lesson, type VisualAsset, type VisualManifest } from "@sbi/contracts";
import type { LlmProvider } from "@sbi/llm";
import { loadFixtures } from "@sbi/testing";
import { memoryPubChemCache } from "@sbi/visuals/server";
import { describe, expect, it, vi } from "vitest";
import { createVisualMaker } from "./visual-maker";

const kettle = Lesson.parse(
  loadFixtures(
    join(import.meta.dirname, "../../../../packages/contracts/src/fixtures/lesson"),
  ).valid.find((item) => item.name === "kettle-full.json")?.data,
);
const lesson: Lesson = { ...kettle, visuals: [] };
const claimId = lesson.claims[0]?.claimId ?? "";

const PROCESS = {
  kind: "process",
  alt: "How a kettle switches itself off",
  longDescription:
    "The water boils, steam heats the strip, and the strip bends to flip the switch.",
  fallbackText: "Steam bends a metal strip, which flips the switch off.",
  assumptions: ["Sea level"],
  labels: [{ id: "strip", text: "Bimetallic strip", claimId }],
  controls: [],
  readouts: [],
  mjcf: "",
  bindings: [],
  mermaid:
    "flowchart LR\n  boil[Water boils] --> steam[Steam rises]\n  steam --> strip[Strip bends] --> off[Switch flips off]",
  graph: { x: { name: "x", label: "", unit: "", from: 0, to: 1 }, series: [], mark: "line" },
  molecules: [],
  code: "",
};

const NONE = { ...PROCESS, kind: "none" };

// The experiment and the diagram are asked side by side, so answers go by prompt.
function provider(answer: unknown, diagram: unknown = NONE): LlmProvider {
  return {
    id: "test",
    model: "test",
    complete: vi.fn(async (request: { prompt?: { id: string } }) => ({
      text: JSON.stringify(request.prompt?.id === "visual-diagram" ? diagram : answer),
      model: "test",
      latencyMs: 1,
      usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
    })),
  };
}

function stores() {
  const manifests: VisualManifest[] = [];
  const assets: VisualAsset[] = [];
  const lessons: Lesson[] = [];
  return {
    manifests,
    assets,
    lessons,
    deps: {
      manifests: { save: async (m: VisualManifest) => void manifests.push(m) },
      assets: { save: async (a: VisualAsset) => void assets.push(a) },
      lessons: { save: async (l: Lesson) => void lessons.push(l) },
      pubchem: memoryPubChemCache(),
    },
  };
}

const cleared = { check: async () => ({ cleared: true }) };

describe("createVisualMaker", () => {
  it("stores the visual, its rights records and the lesson that now shows it", async () => {
    const store = stores();
    const make = createVisualMaker({ provider: provider(PROCESS), rights: cleared, ...store.deps });

    const [ref] = await make(lesson);

    expect(ref).toMatchObject({ kind: "process", alt: PROCESS.alt });
    expect(ref?.manifestUri).toBe(`/visuals?visualId=${ref?.visualId}`);
    expect(store.manifests[0]?.visualId).toBe(ref?.visualId);
    expect(store.assets.map((asset) => asset.assetId)).toEqual(store.manifests[0]?.assetIds);
    expect(store.lessons[0]?.visuals).toEqual([ref]);
    expect(store.lessons[0]?.reuse.contentHash).not.toBe(lesson.reuse.contentHash);
  });

  it("asks for a visual on the lesson's own experiment", async () => {
    const guitar = Lesson.parse(
      loadFixtures(
        join(import.meta.dirname, "../../../../packages/contracts/src/fixtures/lesson"),
      ).valid.find((item) => item.name === "merrill-guitar.json")?.data,
    );
    const llm = provider({ ...PROCESS, labels: [] });
    await createVisualMaker({ provider: llm, rights: cleared, ...stores().deps })(guitar);
    const requests = vi.mocked(llm.complete).mock.calls.map(([request]) => request);
    const experiment = requests.find((request) => request.prompt?.id === "visual-generate");
    const user = String(experiment?.messages[1]?.content);
    expect(user).toContain("- control tension (Tension, N): min 40, max 200, value 110");
    expect(user).toContain("- readout pitch (Pitch, Hz)");

    const diagram = requests.find((request) => request.prompt?.id === "visual-diagram");
    const asked = String(diagram?.messages[1]?.content);
    expect(asked).toContain("Demonstration steps:\n1. Start at 110 N");
    expect(asked).not.toContain("control tension");
  });

  it("adds a stage diagram beside the experiment, with the experiment first", async () => {
    const store = stores();
    const diagram = { ...PROCESS, alt: "The stages of switching off" };
    const make = createVisualMaker({
      provider: provider(PROCESS, diagram),
      rights: cleared,
      ...store.deps,
    });
    const refs = await make(lesson);
    expect(refs.map((ref) => ref.alt)).toEqual([PROCESS.alt, diagram.alt]);
    expect(store.manifests).toHaveLength(2);
    expect(store.lessons[0]?.visuals).toEqual(refs);
  });

  it("keeps the diagram when the experiment visual cannot be made", async () => {
    const store = stores();
    const make = createVisualMaker({
      provider: provider(NONE, PROCESS),
      rights: cleared,
      ...store.deps,
    });
    const refs = await make(lesson);
    expect(refs.map((ref) => ref.kind)).toEqual(["process"]);
    expect(store.lessons[0]?.visuals).toEqual(refs);
  });

  it("keeps the visual a reused lesson already has, without asking the model", async () => {
    const llm = provider(PROCESS);
    const make = createVisualMaker({ provider: llm, rights: cleared, ...stores().deps });
    const visual = {
      visualId: "0192f1a0-0000-7000-8000-000000000501",
      kind: "process" as const,
      manifestUri: "/visuals?visualId=0192f1a0-0000-7000-8000-000000000501",
      alt: "Kettle",
    };
    expect(await make({ ...lesson, visuals: [visual] })).toEqual([visual]);
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it("ships the lesson without a visual when the gate does not clear it", async () => {
    const store = stores();
    const blocked = { check: async () => ({ cleared: false, reason: "review overdue" }) };
    const make = createVisualMaker({ provider: provider(PROCESS), rights: blocked, ...store.deps });
    expect(await make(lesson)).toEqual([]);
    expect(store.lessons).toHaveLength(0);
  });

  it("ships the lesson without a visual when the model fails or chooses none", async () => {
    const failing: LlmProvider = {
      id: "test",
      model: "test",
      complete: async () => {
        throw new Error("timeout");
      },
    };
    expect(
      await createVisualMaker({ provider: failing, rights: cleared, ...stores().deps })(lesson),
    ).toEqual([]);
    const none = { ...PROCESS, kind: "none" };
    expect(
      await createVisualMaker({ provider: provider(none), rights: cleared, ...stores().deps })(
        lesson,
      ),
    ).toEqual([]);
    expect(
      await createVisualMaker({ provider: null, rights: cleared, ...stores().deps })(lesson),
    ).toEqual([]);
  });
});
