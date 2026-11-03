import type {
  ControlSetting,
  DemonstrationStep,
  Lesson,
  VisualAction,
  VisualManifest,
} from "@sbi/contracts";

/** The parts of the lesson's existing visual the tutor may move; it never makes a new one. */
export interface ShowContext {
  visualId: string;
  controls: VisualManifest["controls"];
  labels: VisualManifest["labels"];
  steps: DemonstrationStep[];
}

/** The model's request, before it is checked; steps are numbered from 1 as the prompt shows them. */
export interface DraftShow {
  settings: { control: string; value: number }[];
  step: number | null;
  highlight: string | null;
}

export const NO_SHOW: DraftShow = { settings: [], step: null, highlight: null };

export function showContext(
  lesson: Pick<Lesson, "sections">,
  manifest: VisualManifest | undefined,
): ShowContext | undefined {
  if (!manifest || (manifest.controls.length === 0 && manifest.labels.length === 0)) {
    return undefined;
  }
  const steps = lesson.sections
    .filter((section) => section.module === "demonstrate")
    .flatMap((section) => section.steps ?? []);
  return {
    visualId: manifest.visualId,
    controls: manifest.controls,
    labels: manifest.labels,
    steps,
  };
}

/** Lines for the prompt naming every slider, step and part by the ids the model must use. */
export function describeShow(show: ShowContext): string {
  const sliders = show.controls.map(
    (control) =>
      `${control.id} (${control.label}, ${control.min} to ${control.max}${control.unit ? ` ${control.unit}` : ""})`,
  );
  const steps = show.steps
    .filter((step) => step.settings.length > 0)
    .map((step) => `${show.steps.indexOf(step) + 1}. ${step.text}`);
  const parts = show.labels.map((label) => `${label.id} (${label.text})`);
  return [
    sliders.length ? `Sliders: ${sliders.join("; ")}` : "",
    steps.length ? `Demonstration steps:\n${steps.join("\n")}` : "",
    parts.length ? `Parts: ${parts.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function inRange(show: ShowContext, setting: ControlSetting): ControlSetting | undefined {
  const control = show.controls.find((item) => item.id === setting.controlId);
  if (!control || !Number.isFinite(setting.value)) return undefined;
  if (setting.value < control.min || setting.value > control.max) return undefined;
  // Snapped to the slider's step, so the value shown is one the learner could set by hand.
  const steps = Math.round((setting.value - control.min) / control.step);
  const value = Math.min(control.max, control.min + steps * control.step);
  return { controlId: control.id, value: Number(value.toFixed(6)) };
}

/** Keeps only what the visual really offers; anything unknown or out of range is dropped. */
export function validateVisualAction(
  draft: DraftShow,
  show: ShowContext | undefined,
): VisualAction | undefined {
  if (!show) return undefined;
  const index = draft.step === null ? undefined : draft.step - 1;
  const step = index === undefined ? undefined : show.steps[index];
  const requested = step
    ? step.settings
    : draft.settings.map((item) => ({ controlId: item.control, value: item.value }));
  const settings: ControlSetting[] = [];
  for (const setting of requested) {
    const checked = inRange(show, setting);
    if (!checked) {
      // A step only makes sense whole, so one unusable setting drops the step.
      if (step) return validateVisualAction({ ...draft, step: null, settings: [] }, show);
      continue;
    }
    if (!settings.some((item) => item.controlId === checked.controlId)) settings.push(checked);
  }
  const highlight = show.labels.find((label) => label.id === draft.highlight)?.id;
  if (settings.length === 0 && !highlight) return undefined;
  return {
    visualId: show.visualId,
    settings: settings.slice(0, 4),
    ...(step && settings.length > 0 ? { step: index } : {}),
    ...(highlight ? { highlight } : {}),
  };
}
