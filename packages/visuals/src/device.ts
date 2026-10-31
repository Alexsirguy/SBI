import type { VisualKind } from "@sbi/contracts";

export interface DeviceTier {
  webgl: boolean;
  /** The learner asked their browser to use less data. */
  saveData: boolean;
  /** `navigator.deviceMemory` at 2 GB or less, where a 2.7 MB engine and its scene can stall. */
  lowMemory: boolean;
}

/** What this browser can afford, read once per page. */
export function readDevice(window: Window): DeviceTier {
  const navigator = window.navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  let webgl: boolean;
  try {
    const canvas = window.document.createElement("canvas");
    webgl = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    // Some privacy modes throw rather than return null; either way there is no 3D.
    webgl = false;
  }
  return {
    webgl,
    saveData: navigator.connection?.saveData === true,
    lowMemory: typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 2,
  };
}

const NEEDS_WEBGL: ReadonlySet<VisualKind> = new Set(["mechanism", "molecule"]);
// Only MuJoCo is heavy enough to matter on a data plan or a small phone (ADR 0014).
const HEAVY: ReadonlySet<VisualKind> = new Set(["mechanism"]);

/** Why this device should get the text fallback for a kind, or undefined when it can draw it. */
export function deviceFallbackReason(kind: VisualKind, device: DeviceTier): string | undefined {
  if (NEEDS_WEBGL.has(kind) && !device.webgl) return "this device cannot draw 3D";
  if (HEAVY.has(kind) && device.saveData) return "the browser is saving data";
  if (HEAVY.has(kind) && device.lowMemory) return "this device has little memory";
  return undefined;
}
