import { VisualAsset, type Lesson, type VisualManifest } from "@sbi/contracts";
import { describe, expect, it } from "vitest";
import { LIBRARY_ASSETS, LIBRARY_ASSET_IDS, projectOutputAsset } from "./libraries";
import { createRightsRegister } from "./register";

const LESSON_ID = "5f0c1d9a-7a39-4d5e-9b51-2f1f3c1d2e10";
const VISUAL_ID = "9b2f0e0a-1c4d-4f6e-8a7b-3c2d1e0f9a8b";
const ASSET_ID = "d1c2b3a4-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const SHA = "a".repeat(64);
const THREE = LIBRARY_ASSET_IDS["three"] ?? "";

function output(overrides: Partial<VisualAsset> = {}): VisualAsset {
  return {
    ...projectOutputAsset({
      assetId: ASSET_ID,
      kind: "data",
      format: "mjcf",
      sha256: SHA,
      sizeBytes: 900,
      accessibilityFallback: "A piston moves up and down inside a cylinder.",
    }),
    ...overrides,
  };
}

const manifest: VisualManifest = {
  visualId: VISUAL_ID,
  kind: "simulation",
  alt: "Piston engine",
  fallback: { text: "A piston moves up and down inside a cylinder." },
  assetIds: [ASSET_ID],
  assumptions: [],
  params: {},
};

function lesson(visuals: Lesson["visuals"]): Lesson {
  return { lessonId: LESSON_ID, visuals } as Lesson;
}

const ref = {
  visualId: VISUAL_ID,
  kind: "simulation",
  manifestUri: "/visuals/x",
  alt: "Engine",
} as const;

function register(
  assets: VisualAsset[],
  options: { manifests?: VisualManifest[]; libraries?: string[]; today?: string } = {},
) {
  const byId = new Map(assets.map((asset) => [asset.assetId, asset]));
  const manifests = new Map((options.manifests ?? [manifest]).map((m) => [m.visualId, m]));
  return createRightsRegister({
    assets: { get: async (id) => byId.get(id) },
    manifests: { get: async (id) => manifests.get(id) },
    librariesFor: () => options.libraries ?? [],
    today: () => options.today ?? "2026-10-31",
  });
}

describe("checkAsset", () => {
  it("clears a complete record of our own work", async () => {
    expect(await register([output()]).checkAsset(ASSET_ID)).toEqual({ cleared: true });
  });

  it("blocks an asset with no record", async () => {
    const decision = await register([]).checkAsset(ASSET_ID);
    expect(decision).toEqual({
      cleared: false,
      reason: expect.stringContaining("no rights record"),
    });
  });

  it("blocks a record missing a required field, naming it", async () => {
    const incomplete = { ...output(), attribution: "" };
    const decision = await register([incomplete]).checkAsset(ASSET_ID);
    expect(decision.reason).toMatch(/incomplete rights record \(attribution\)/);
  });

  it("blocks a record with no licence of either kind", async () => {
    const unlicensed = { ...output(), assetLicense: undefined };
    expect((await register([unlicensed]).checkAsset(ASSET_ID)).cleared).toBe(false);
  });

  it("blocks once the review date has passed", async () => {
    const due = output({ reviewDueOn: "2026-10-30" });
    expect((await register([due]).checkAsset(ASSET_ID)).reason).toMatch(/due for review/);
    expect(
      (await register([output({ reviewDueOn: "2026-10-31" })]).checkAsset(ASSET_ID)).cleared,
    ).toBe(true);
  });

  it.each(["prohibited", "unknown"] as const)("blocks commercial use %s", async (commercialUse) => {
    const decision = await register([output({ commercialUse })]).checkAsset(ASSET_ID);
    expect(decision.reason).toMatch(new RegExp(`commercial use ${commercialUse}`));
  });

  it("clears a restricted asset only for the lessons it was approved for", async () => {
    const restricted = output({ commercialUse: "restricted", approvedLessonIds: [LESSON_ID] });
    expect(
      (await register([restricted]).checkAsset(ASSET_ID, { lessonId: LESSON_ID })).cleared,
    ).toBe(true);
    expect((await register([restricted]).checkAsset(ASSET_ID)).cleared).toBe(false);
  });

  it("treats approved lessons as an allowlist", async () => {
    const limited = output({ approvedLessonIds: [LESSON_ID] });
    const other = "0e0d0c0b-0a09-4807-8605-040302010000";
    expect((await register([limited]).checkAsset(ASSET_ID, { lessonId: other })).reason).toMatch(
      /only for other lessons/,
    );
  });

  it("blocks when the stored record cannot be read", async () => {
    const target = createRightsRegister({
      assets: { get: () => Promise.reject(new Error("bad JSON")) },
      manifests: { get: async () => undefined },
    });
    expect((await target.checkAsset(ASSET_ID)).cleared).toBe(false);
  });
});

describe("check", () => {
  it("clears a lesson with no visuals", async () => {
    expect(await register([]).check(lesson([]))).toEqual({ cleared: true });
  });

  it("clears a visual whose assets and libraries all clear", async () => {
    const target = register([output(), ...LIBRARY_ASSETS], {
      libraries: [THREE],
    });
    expect(await target.check(lesson([ref]))).toEqual({ cleared: true });
  });

  it("blocks a visual without a manifest", async () => {
    const decision = await register([output()], { manifests: [] }).check(lesson([ref]));
    expect(decision.reason).toMatch(/has no manifest/);
  });

  it("blocks a manifest whose kind differs from the reference", async () => {
    const decision = await register([output()]).check(lesson([{ ...ref, kind: "molecular" }]));
    expect(decision.reason).toMatch(/is a simulation, not a molecular/);
  });

  it("blocks a manifest that records no assets", async () => {
    const bare = { ...manifest, assetIds: [] };
    const decision = await register([output()], { manifests: [bare] }).check(lesson([ref]));
    expect(decision.reason).toMatch(/records no assets/);
  });

  it("blocks when a library the renderer loads has no record", async () => {
    const decision = await register([output()], {
      libraries: [THREE],
    }).check(lesson([ref]));
    expect(decision.reason).toMatch(/no rights record/);
  });
});

describe("verifyChecksum", () => {
  it("clears matching bytes and blocks different ones", async () => {
    const target = register([output()]);
    expect(await target.verifyChecksum(ASSET_ID, SHA)).toEqual({ cleared: true });
    expect((await target.verifyChecksum(ASSET_ID, "b".repeat(64))).reason).toMatch(/checksum/);
  });
});

describe("library records", () => {
  it("are complete and clear today", async () => {
    const target = register([...LIBRARY_ASSETS]);
    for (const asset of LIBRARY_ASSETS) {
      expect(VisualAsset.safeParse(asset).success).toBe(true);
      expect(await target.checkAsset(asset.assetId)).toEqual({ cleared: true });
    }
  });

  it("cover every library ADR 0014 names", () => {
    expect(Object.keys(LIBRARY_ASSET_IDS).sort()).toEqual(
      [
        "3dmol",
        "@mujoco/mujoco",
        "acorn",
        "mathjs",
        "matter-js",
        "mermaid",
        "three",
        "vega",
        "vega-embed",
        "vega-lite",
      ].sort(),
    );
  });
});
