import type { ControlSetting, VisualManifest } from "@sbi/contracts";
import { compileFormula, type CompiledFormula } from "@sbi/visuals/formula";

/** Drives the lesson's visual through its own sliders, as if the learner had moved them. */
export interface ExperimentController {
  visualId: string;
  /** True when the visual offers every control and readout named. */
  has(ids: { controls?: string[]; readouts?: string[] }): boolean;
  set(controlId: string, value: number): boolean;
  apply(settings: ControlSetting[]): boolean;
  values(): Record<string, number>;
  readout(readoutId: string): number | undefined;
  subscribe(listener: () => void): () => void;
  /** Marks one part in the visual's key, or clears the mark; false when the visual has no such part. */
  highlight(labelId: string | undefined): boolean;
  /** Centres the visual, clear of the sticky header, without motion when the learner prefers less. */
  reveal(): void;
}

export const visualSliderId = (visualId: string, controlId: string) => `${visualId}-${controlId}`;

/** Evaluates only the manifest's own readout formulas; nothing from the visual's code runs. */
export function createExperimentController(
  manifest: VisualManifest,
  doc: Document = document,
): ExperimentController {
  const controls = new Map(manifest.controls.map((control) => [control.id, control]));
  const names = manifest.controls.map((control) => control.id);
  const formulas = new Map<string, CompiledFormula | undefined>();
  const formula = (readoutId: string) => {
    if (!formulas.has(readoutId)) {
      const readout = manifest.readouts.find((item) => item.id === readoutId);
      const compiled = readout ? compileFormula(readout.formula, names) : undefined;
      formulas.set(readoutId, compiled && !("error" in compiled) ? compiled : undefined);
    }
    return formulas.get(readoutId);
  };
  const slider = (controlId: string) => {
    const element = doc.getElementById(visualSliderId(manifest.visualId, controlId));
    return element?.tagName === "INPUT" ? (element as HTMLInputElement) : undefined;
  };
  const values = () =>
    Object.fromEntries(
      manifest.controls.map((control) => {
        const input = slider(control.id);
        const value = input ? Number(input.value) : control.value;
        return [control.id, Number.isFinite(value) ? value : control.value];
      }),
    );
  const set = (controlId: string, value: number) => {
    const control = controls.get(controlId);
    const input = slider(controlId);
    if (!control || !input) return false;
    input.value = String(Math.min(control.max, Math.max(control.min, value)));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  };
  const container = () =>
    doc.querySelector(`[data-visual-id="${manifest.visualId}"]`) ??
    slider(manifest.controls[0]?.id ?? "")?.closest("figure");
  const labels = new Set(manifest.labels.map((label) => label.id));
  return {
    visualId: manifest.visualId,
    has: ({ controls: wanted = [], readouts = [] }) =>
      wanted.every((id) => controls.has(id)) && readouts.every((id) => formula(id) !== undefined),
    set,
    apply: (settings) =>
      settings.map((setting) => set(setting.controlId, setting.value)).every(Boolean),
    values,
    readout(readoutId) {
      try {
        return formula(readoutId)?.evaluate(values());
      } catch {
        return undefined;
      }
    },
    subscribe(listener) {
      const prefix = visualSliderId(manifest.visualId, "");
      const onInput = (event: Event) => {
        const target = event.target as Element | null;
        if (target?.id?.startsWith(prefix)) listener();
      };
      doc.addEventListener("input", onInput);
      return () => doc.removeEventListener("input", onInput);
    },
    highlight(labelId) {
      const parts = container()?.querySelectorAll<HTMLElement>("[data-label]") ?? [];
      let found = false;
      for (const part of parts) {
        const marked =
          labelId !== undefined && labels.has(labelId) && part.dataset.label === labelId;
        part.toggleAttribute("data-highlighted", marked);
        found ||= marked;
      }
      return labelId === undefined || found;
    },
    reveal() {
      const target = container();
      const still = doc.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      target?.scrollIntoView?.({ behavior: still ? "auto" : "smooth", block: "center" });
    },
  };
}
