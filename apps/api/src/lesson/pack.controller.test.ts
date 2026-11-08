import { join } from "node:path";
import {
  Lesson,
  LessonPack,
  newId,
  VisualManifest,
  type Lesson as LessonRecord,
} from "@sbi/contracts";
import { pubChemStructureAsset } from "@sbi/rights";
import { loadFixtures } from "@sbi/testing";
import { afterEach, describe, expect, it } from "vitest";
import { startTestApp, WEB_ORIGIN, type TestApp } from "../testing/test-app";
import {
  LESSON_EVIDENCE,
  LESSON_RIGHTS,
  LESSONS,
  VISUAL_ASSETS,
  VISUAL_INTEGRITY,
  VISUAL_MANIFESTS,
} from "../tokens";

const fixture = Lesson.parse(
  loadFixtures(
    join(import.meta.dirname, "../../../../packages/contracts/src/fixtures/lesson"),
  ).valid.find((item) => item.name === "kettle-full.json")?.data,
);
const visual = (kind: VisualManifest["kind"], text: string, assetIds: string[] = []) =>
  VisualManifest.parse({
    alt: `${kind} visual`,
    assetIds,
    fallback: { text },
    kind,
    spec: kind === "playground" ? { code: "draw()" } : "graph TD; A-->B",
    visualId: newId(),
  });

const structure = pubChemStructureAsset({
  accessibilityFallback: "A water molecule",
  assetId: newId(),
  cid: 962,
  sha256: "a".repeat(64),
  sizeBytes: 10,
});
const cleared = visual("process", "Warm water rises.", [structure.assetId]);
const blocked = visual("process", "Steam leaves through the spout.", [newId()]);
const playground = visual("playground", "Drag the slider to heat the water.", [structure.assetId]);
const missing = newId();
const lesson: LessonRecord = {
  ...fixture,
  assumptions: ["I live at sea level"],
  visuals: [
    ...[cleared, blocked, playground].map((item) => ({
      alt: item.alt,
      kind: item.kind,
      manifestUri: `/visuals?visualId=${item.visualId}`,
      visualId: item.visualId,
    })),
    { alt: "gone", kind: "graph", manifestUri: "/visuals", visualId: missing },
  ],
};

async function start() {
  const checked: string[][] = [];
  return {
    checked,
    test: await startTestApp(undefined, undefined, undefined, (builder) =>
      builder
        .overrideProvider(LESSONS)
        .useValue({
          get: async (id: string, version: number) =>
            id === lesson.lessonId && version === lesson.version ? lesson : undefined,
          save: async () => undefined,
        })
        .overrideProvider(LESSON_EVIDENCE)
        .useValue({ claims: { getMany: async () => [] }, sources: { getMany: async () => [] } })
        .overrideProvider(LESSON_RIGHTS)
        .useValue({
          check: async (only: LessonRecord) => {
            checked.push(only.visuals.map((ref) => ref.visualId));
            return only.visuals.some((ref) => ref.visualId === blocked.visualId)
              ? { cleared: false, reason: "asset has no rights record" }
              : { cleared: true };
          },
        })
        .overrideProvider(VISUAL_MANIFESTS)
        .useValue({
          get: async (id: string) => [cleared, blocked, playground].find((v) => v.visualId === id),
          save: async () => undefined,
        })
        .overrideProvider(VISUAL_INTEGRITY)
        .useValue(async () => true)
        .overrideProvider(VISUAL_ASSETS)
        .useValue({
          get: async (id: string) => (id === structure.assetId ? structure : undefined),
        }),
    ),
  };
}

describe("lesson packs", () => {
  let test: TestApp | undefined;

  afterEach(async () => {
    await test?.app.close();
  });

  it("packs cleared visuals with their credits and gives the rest as text", async () => {
    const s = await start();
    test = s.test;
    const response = await test.post(
      "/lessons/pack",
      { lessonId: lesson.lessonId, version: lesson.version },
      { origin: WEB_ORIGIN },
    );
    expect(response.status).toBe(200);
    const pack = LessonPack.parse(await response.json());

    expect(pack.visuals.map((item) => item.visualId)).toEqual([cleared.visualId]);
    expect(pack.visuals[0]?.credits).toEqual([
      expect.objectContaining({
        assetId: structure.assetId,
        text: expect.stringContaining("PubChem"),
      }),
    ]);
    expect(pack.withheld).toEqual([
      expect.objectContaining({
        reason: "rights",
        text: "Steam leaves through the spout.",
        visualId: blocked.visualId,
      }),
      expect.objectContaining({ reason: "needs-connection", visualId: playground.visualId }),
      expect.objectContaining({ reason: "unavailable", text: "gone", visualId: missing }),
    ]);
    // One visual per check, so one uncleared asset never sinks the whole pack.
    expect(s.checked.every((ids) => ids.length === 1)).toBe(true);
    expect(pack.lesson.assumptions).toEqual([]);
    expect(pack.format).toBe("sbi-lesson-pack");
  });

  it("says when the lesson doesn't exist", async () => {
    const s = await start();
    test = s.test;
    const response = await test.post(
      "/lessons/pack",
      { lessonId: newId(), version: 1 },
      { origin: WEB_ORIGIN },
    );
    expect(response.status).toBe(404);
  });
});
