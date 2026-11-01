import { canonicalJson, newId, sha256Hex, VisualManifest, type VisualAsset } from "@sbi/contracts";
import { projectOutputAsset } from "@sbi/rights";
import { GALLERY_FIXTURES } from "@sbi/visuals";
import { afterEach, describe, expect, it } from "vitest";
import { startTestApp, WEB_ORIGIN, type TestApp } from "../testing/test-app";
import { VISUAL_INTEGRITY, VISUAL_MANIFESTS } from "../tokens";
import { createSpecIntegrity } from "./integrity";

const rainbow = GALLERY_FIXTURES.find((item) => item.kind === "playground");
const process = GALLERY_FIXTURES.find((item) => item.kind === "process");

async function recorded(manifest: VisualManifest, spec: unknown): Promise<VisualAsset> {
  const body = canonicalJson(spec);
  return projectOutputAsset({
    assetId: manifest.assetIds[0] ?? newId(),
    kind: "data",
    format: manifest.kind,
    sha256: await sha256Hex(body),
    sizeBytes: body.length,
    accessibilityFallback: manifest.fallback.text,
  });
}

function app(manifests: VisualManifest[], assets: VisualAsset[] = []) {
  return startTestApp(undefined, undefined, undefined, (builder) =>
    builder
      .overrideProvider(VISUAL_MANIFESTS)
      .useValue({
        save: async () => undefined,
        get: async (id: string) => manifests.find((item) => item.visualId === id),
      })
      .overrideProvider(VISUAL_INTEGRITY)
      .useValue(createSpecIntegrity({ get: async (id) => assets.find((a) => a.assetId === id) })),
  );
}

describe("playground documents", () => {
  let test: TestApp | undefined;

  afterEach(async () => {
    await test?.app.close();
  });

  it("serves the frame sandboxed, framed only by the web app, with nothing else allowed", async () => {
    test = await app([]);
    const response = await fetch(`${test.url}/playgrounds?visualId=${rainbow?.visualId}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toContain("immutable");
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("sandbox allow-scripts");
    expect(csp).toContain(`frame-ancestors ${WEB_ORIGIN}`);
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toMatch(/unsafe-eval|allow-same-origin|connect-src/);
    expect(await response.text()).toContain("kit.onFrame");
  });

  it("answers 404 for a visual that is not a playground, or unknown", async () => {
    test = await app([]);
    for (const id of [process?.visualId, newId()]) {
      expect((await fetch(`${test.url}/playgrounds?visualId=${id}`)).status).toBe(404);
    }
  });

  it("refuses a stored playground whose code changed after its check", async () => {
    const stored = VisualManifest.parse({ ...rainbow, visualId: newId(), assetIds: [newId()] });
    const asset = await recorded(stored, { code: "kit.onFrame(() => {});" });
    test = await app([stored], [asset]);

    const response = await fetch(`${test.url}/playgrounds?visualId=${stored.visualId}`);
    expect(response.status).toBe(409);
    const manifest = await fetch(`${test.url}/visuals?visualId=${stored.visualId}`);
    expect(manifest.status).toBe(409);
  });

  it("serves a stored playground that still matches its record", async () => {
    const stored = VisualManifest.parse({ ...rainbow, visualId: newId(), assetIds: [newId()] });
    test = await app([stored], [await recorded(stored, stored.spec)]);
    expect((await fetch(`${test.url}/playgrounds?visualId=${stored.visualId}`)).status).toBe(200);
  });
});
