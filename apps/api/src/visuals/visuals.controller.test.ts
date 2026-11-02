import { newId, ServedVisual, VisualManifest } from "@sbi/contracts";
import { LIBRARY_ASSETS, pubChemStructureAsset } from "@sbi/rights";
import type { VisualManifestRepository } from "@sbi/visuals";
import { afterEach, describe, expect, it } from "vitest";
import { startTestApp, WEB_ORIGIN, type TestApp } from "../testing/test-app";
import { VISUAL_ASSETS, VISUAL_INTEGRITY, VISUAL_MANIFESTS } from "../tokens";

const manifest = VisualManifest.parse({
  visualId: newId(),
  kind: "process",
  alt: "How a kettle heats water",
  fallback: { text: "The element heats the water at the bottom; warm water rises." },
});

function withManifests(...stored: VisualManifest[]) {
  const repo: VisualManifestRepository = {
    save: async () => undefined,
    get: async (visualId) => stored.find((item) => item.visualId === visualId),
  };
  return (builder: Parameters<NonNullable<Parameters<typeof startTestApp>[3]>>[0]) =>
    builder.overrideProvider(VISUAL_MANIFESTS).useValue(repo);
}

describe("visual routes", () => {
  let test: TestApp | undefined;

  afterEach(async () => {
    await test?.app.close();
  });

  it("serves a stored manifest that matches the contract", async () => {
    test = await startTestApp(undefined, undefined, undefined, withManifests(manifest));

    const response = await fetch(`${test.url}/visuals?visualId=${manifest.visualId}`, {
      headers: { origin: WEB_ORIGIN },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
    expect(ServedVisual.parse(await response.json())).toEqual({ ...manifest, credits: [] });
  });

  it("credits the third-party assets a visual uses, and not its software", async () => {
    const structure = pubChemStructureAsset({
      assetId: newId(),
      cid: 962,
      sha256: "a".repeat(64),
      sizeBytes: 10,
      accessibilityFallback: "A water molecule",
    });
    const library = LIBRARY_ASSETS[0];
    if (!library) throw new Error("no library records");
    const molecule = { ...manifest, assetIds: [library.assetId, structure.assetId] };
    const assets = [structure, library];
    test = await startTestApp(undefined, undefined, undefined, (builder) =>
      withManifests(molecule)(builder)
        .overrideProvider(VISUAL_INTEGRITY)
        .useValue(async () => true)
        .overrideProvider(VISUAL_ASSETS)
        .useValue({ get: async (id: string) => assets.find((asset) => asset.assetId === id) }),
    );

    const response = await fetch(`${test.url}/visuals?visualId=${manifest.visualId}`);
    const served = ServedVisual.parse(await response.json());
    expect(served.credits).toEqual([
      expect.objectContaining({
        assetId: structure.assetId,
        itemUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/962",
        shareAlike: false,
      }),
    ]);
  });

  it("answers 404 for a visual it does not hold", async () => {
    test = await startTestApp(undefined, undefined, undefined, withManifests());

    const response = await fetch(`${test.url}/visuals?visualId=${newId()}`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "That visual is not available." });
  });

  it("rejects a missing or malformed id", async () => {
    test = await startTestApp(undefined, undefined, undefined, withManifests());

    for (const query of ["", "?visualId=kettle"]) {
      const response = await fetch(`${test.url}/visuals${query}`);
      expect(response.status).toBe(400);
    }
  });
});
