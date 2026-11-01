import type { VisualManifest } from "@sbi/contracts";

/** The lesson's experiment (ADR 0017): its sliders and readouts are what the learner is set. */
export interface ExperimentForVisual {
  controls: { id: string; label: string; unit: string; min: number; max: number; value: number }[];
  readouts: { id: string; label: string; unit: string }[];
}

// Molecules and processes have no sliders, so they cannot carry an experiment.
const WITHOUT_CONTROLS = new Set<VisualManifest["kind"]>(["molecule", "process"]);

/** Takes each matching control's range and start from the experiment, so the two can never drift. */
export function alignedControls<
  Control extends { id: string; min: number; max: number; step: number; value: number },
>(controls: Control[], experiment: ExperimentForVisual | undefined): Control[] {
  const wanted = new Map(experiment?.controls.map((control) => [control.id, control]) ?? []);
  return controls.map((control) => {
    const target = wanted.get(control.id);
    if (!target) return control;
    const { min, max, value } = target;
    // A step set for the visual's own range may not fit the experiment's.
    const step =
      control.step <= 0 || (max - min) / control.step > 100 ? (max - min) / 100 : control.step;
    return { ...control, min, max, value, step };
  });
}

/** Experiment ids the visual leaves out, worded for the AI's repair attempt. */
export function experimentProblems(
  manifest: Pick<VisualManifest, "kind" | "controls" | "readouts">,
  experiment: ExperimentForVisual | undefined,
): string[] {
  if (!experiment || WITHOUT_CONTROLS.has(manifest.kind)) return [];
  const controls = new Set(manifest.controls.map((control) => control.id));
  const readouts = new Set(manifest.readouts.map((readout) => readout.id));
  return [
    ...experiment.controls
      .filter((control) => !controls.has(control.id))
      .map(
        (control) =>
          `add a control with id "${control.id}" (${control.label}, ${control.unit || "no unit"}, min ${control.min}, max ${control.max}, value ${control.value}); the lesson's tasks move it`,
      ),
    ...experiment.readouts
      .filter((readout) => !readouts.has(readout.id))
      .map(
        (readout) =>
          `add a readout with id "${readout.id}" (${readout.label}, ${readout.unit || "no unit"}) and a formula from the controls; the lesson's goals read it`,
      ),
  ];
}
