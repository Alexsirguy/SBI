// @vitest-environment happy-dom
import { VisualManifest } from "@sbi/contracts";
import { describe, expect, it, vi } from "vitest";
import { deviceFallbackReason, type DeviceTier } from "./device";
import { createRegistry } from "./registry";
import type { VisualRenderer } from "./renderer";

const CAPABLE: DeviceTier = { webgl: true, saveData: false, lowMemory: false };

describe("deviceFallbackReason", () => {
  it("lets a capable device draw every kind", () => {
    for (const kind of ["mechanism", "molecule", "process", "graph", "playground"] as const) {
      expect(deviceFallbackReason(kind, CAPABLE)).toBeUndefined();
    }
  });

  it("keeps 3D kinds off devices without WebGL, and 2D kinds on them", () => {
    const flat = { ...CAPABLE, webgl: false };
    expect(deviceFallbackReason("mechanism", flat)).toBe("this device cannot draw 3D");
    expect(deviceFallbackReason("molecule", flat)).toBe("this device cannot draw 3D");
    expect(deviceFallbackReason("graph", flat)).toBeUndefined();
    expect(deviceFallbackReason("playground", flat)).toBeUndefined();
  });

  it("spares a data plan or a small phone the 2.7 MB engine, but not the light kinds", () => {
    expect(deviceFallbackReason("mechanism", { ...CAPABLE, saveData: true })).toMatch(
      /saving data/,
    );
    expect(deviceFallbackReason("mechanism", { ...CAPABLE, lowMemory: true })).toMatch(
      /little memory/,
    );
    expect(deviceFallbackReason("molecule", { ...CAPABLE, saveData: true })).toBeUndefined();
  });
});

const engine = VisualManifest.parse({
  visualId: "0192f1a0-0000-7000-8000-000000000601",
  kind: "mechanism",
  alt: "Engine",
  fallback: { text: "The piston turns the crankshaft." },
});

function renderer(load: VisualRenderer["load"]): VisualRenderer {
  return { kind: "mechanism", load, fallback: (m) => m.fallback, describe: (m) => m.alt };
}

describe("registry fallbacks", () => {
  it("shows the text without loading the renderer when the device cannot afford it", async () => {
    const loader = vi.fn(async () => renderer(async () => ({ destroy: () => undefined })));
    const mount = document.createElement("div");
    const result = await createRegistry({ mechanism: loader }).mount(engine, mount, {
      reducedMotion: false,
      device: { ...CAPABLE, webgl: false },
    });
    expect(result.fellBack).toBe("this device cannot draw 3D");
    expect(loader).not.toHaveBeenCalled();
    expect(mount.textContent).toContain("The piston turns the crankshaft.");
  });

  it("falls back when a renderer does not draw in time, and throws the late drawing away", async () => {
    vi.useFakeTimers();
    const destroy = vi.fn();
    let finish: (value: { destroy: () => void }) => void = () => undefined;
    const slow = renderer(() => new Promise((resolve) => (finish = resolve)));
    const mount = document.createElement("div");
    const pending = createRegistry({ mechanism: async () => slow }, { timeoutMs: 5000 }).mount(
      engine,
      mount,
      { reducedMotion: false, device: CAPABLE },
    );
    await vi.advanceTimersByTimeAsync(5000);
    expect((await pending).fellBack).toMatch(/timed out after 5000 ms/);
    finish({ destroy });
    await vi.runAllTimersAsync();
    expect(destroy).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
