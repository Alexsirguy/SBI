// @vitest-environment happy-dom
import type { VisualManifest } from "@sbi/contracts";
import { describe, expect, it, vi } from "vitest";
import { fallbackRenderer } from "./fallback";
import { createRegistry } from "./registry";
import type { VisualRenderer } from "./renderer";

const manifest: VisualManifest = {
  visualId: "0192f1a0-0000-7000-8000-000000000001",
  kind: "process",
  alt: "How a kettle heats water",
  longDescription: "The element warms the water at the bottom, which rises.",
  fallback: { text: "The element heats the water at the bottom; warm water rises." },
  assetIds: [],
  assumptions: [],
  params: {},
};

const OPTIONS = { reducedMotion: false };

function fake(kind: VisualRenderer["kind"], load?: VisualRenderer["load"]): VisualRenderer {
  return {
    kind,
    load:
      load ??
      (async (_manifest, mount) => {
        mount.textContent = `${kind} drawn`;
        return { destroy: () => mount.replaceChildren() };
      }),
    fallback: (m) => m.fallback,
    describe: (m) => m.alt,
  };
}

describe("createRegistry", () => {
  it("loads a kind's renderer only when it is first asked for, then reuses it", async () => {
    const loader = vi.fn(async () => fake("process"));
    const registry = createRegistry({ process: loader });
    expect(loader).not.toHaveBeenCalled();

    await registry.resolve("process");
    await registry.resolve("process");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("draws an allowlisted kind with its own renderer", async () => {
    const mount = document.createElement("div");
    const result = await createRegistry({ process: async () => fake("process") }).mount(
      manifest,
      mount,
      OPTIONS,
    );
    expect(mount.textContent).toBe("process drawn");
    expect(result.fellBack).toBeUndefined();
    result.destroy();
    expect(mount.childNodes).toHaveLength(0);
  });

  it("shows the fallback for a kind outside the allowlist", async () => {
    const mount = document.createElement("div");
    const unknown = { ...manifest, kind: "generated-image" } as unknown as VisualManifest;
    const result = await createRegistry({}).mount(unknown, mount, OPTIONS);
    expect(result.renderer).toBe(fallbackRenderer);
    expect(result.fellBack).toMatch(/no renderer for generated-image/);
    expect(mount.querySelector("figcaption")?.textContent).toBe(manifest.fallback.text);
  });

  it("shows the fallback for an allowlisted kind that has no renderer yet", async () => {
    const result = await createRegistry({}).mount(manifest, document.createElement("div"), OPTIONS);
    expect(result.fellBack).toMatch(/no renderer for process/);
  });

  it("shows the fallback when the renderer's code fails to load, and retries next time", async () => {
    const loader = vi
      .fn<() => Promise<VisualRenderer>>()
      .mockRejectedValueOnce(new Error("chunk failed"))
      .mockResolvedValue(fake("process"));
    const registry = createRegistry({ process: loader });
    const mount = document.createElement("div");

    expect((await registry.mount(manifest, mount, OPTIONS)).fellBack).toMatch(/did not load/);
    expect((await registry.mount(manifest, mount, OPTIONS)).fellBack).toBeUndefined();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("shows the fallback when the renderer throws while drawing", async () => {
    const broken = fake("process", async () => {
      throw new Error("bad spec");
    });
    const mount = document.createElement("div");
    const result = await createRegistry({ process: async () => broken }).mount(
      manifest,
      mount,
      OPTIONS,
    );
    expect(result.fellBack).toMatch(/did not draw: Error: bad spec/);
    expect(mount.textContent).toContain(manifest.fallback.text);
  });
});

describe("fallbackRenderer", () => {
  it("shows the still image with the visual's alt text when there is one", async () => {
    const mount = document.createElement("div");
    const still = {
      ...manifest,
      fallback: { ...manifest.fallback, stillImageUrl: "https://example.org/k.png" },
    };
    await fallbackRenderer.load(still, mount, OPTIONS);
    const image = mount.querySelector("img");
    expect(image?.getAttribute("alt")).toBe(manifest.alt);
    expect(image?.getAttribute("src")).toBe("https://example.org/k.png");
  });

  it("describes a visual by its long description, or its alt text without one", () => {
    expect(fallbackRenderer.describe(manifest)).toBe(manifest.longDescription);
    expect(fallbackRenderer.describe({ ...manifest, longDescription: undefined })).toBe(
      manifest.alt,
    );
  });
});

describe("GALLERY_FIXTURES", () => {
  it("has one manifest for every allowlisted kind", async () => {
    const { GALLERY_FIXTURES } = await import("./fixtures");
    const { VisualKind } = await import("@sbi/contracts");
    expect(GALLERY_FIXTURES.map((item) => item.kind).sort()).toEqual(
      [...VisualKind.options].sort(),
    );
  });
});
