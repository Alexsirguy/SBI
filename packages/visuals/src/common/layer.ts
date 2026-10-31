import type { VisualManifest } from "@sbi/contracts";
import { compileFormula, formatNumber } from "../formula";

export type ControlValues = Record<string, number>;

export interface CommonLayer {
  /** Where the kind draws its own picture. */
  stage: HTMLElement;
  values: ControlValues;
  destroy(): void;
}

function withUnit(value: string, unit: string): string {
  return unit ? `${value} ${unit}` : value;
}

/** Labels, sliders and readouts around the kind's stage; every kind gets the same accessible set. */
export function mountCommonLayer(
  manifest: VisualManifest,
  mount: HTMLElement,
  onChange: (values: ControlValues) => void,
): CommonLayer {
  const document = mount.ownerDocument;
  const root = document.createElement("div");
  root.className = "visual-layer";
  const stage = document.createElement("div");
  stage.className = "visual-layer__stage";
  root.append(stage);

  const values: ControlValues = Object.fromEntries(
    manifest.controls.map((control) => [control.id, control.value]),
  );
  const names = manifest.controls.map((control) => control.id);
  const readouts = manifest.readouts.flatMap((readout) => {
    const compiled = compileFormula(readout.formula, names);
    return "error" in compiled ? [] : [{ readout, compiled }];
  });

  const outputs = new Map<string, HTMLOutputElement>();
  function refresh() {
    for (const { readout, compiled } of readouts) {
      const output = outputs.get(readout.id);
      if (!output) continue;
      try {
        output.textContent = withUnit(formatNumber(compiled.evaluate(values)), readout.unit);
      } catch {
        output.textContent = "—";
      }
    }
  }

  if (manifest.controls.length > 0) {
    const controls = document.createElement("div");
    controls.className = "visual-layer__controls";
    for (const control of manifest.controls) {
      const id = `${manifest.visualId}-${control.id}`;
      const row = document.createElement("div");
      row.className = "visual-layer__control";
      const label = document.createElement("label");
      label.htmlFor = id;
      label.textContent = control.label;
      const value = document.createElement("output");
      value.setAttribute("for", id);
      value.textContent = withUnit(formatNumber(control.value), control.unit);
      const input = document.createElement("input");
      Object.assign(input, {
        type: "range",
        id,
        min: String(control.min),
        max: String(control.max),
        step: String(control.step),
        value: String(control.value),
      });
      input.setAttribute("aria-valuetext", value.textContent);
      input.addEventListener("input", () => {
        values[control.id] = Number(input.value);
        value.textContent = withUnit(formatNumber(values[control.id] ?? 0), control.unit);
        input.setAttribute("aria-valuetext", value.textContent);
        refresh();
        onChange({ ...values });
      });
      row.append(label, value, input);
      controls.append(row);
    }
    root.append(controls);
  }

  if (readouts.length > 0) {
    const list = document.createElement("dl");
    list.className = "visual-layer__readouts";
    for (const { readout } of readouts) {
      const term = document.createElement("dt");
      term.textContent = readout.label;
      const detail = document.createElement("dd");
      const output = document.createElement("output");
      output.setAttribute("aria-live", "polite");
      outputs.set(readout.id, output);
      detail.append(output);
      list.append(term, detail);
    }
    root.append(list);
  }

  // A numbered key instead of text on the picture, so labels never collide on a narrow screen.
  if (manifest.labels.length > 0) {
    const key = document.createElement("ol");
    key.className = "visual-layer__labels";
    key.setAttribute("aria-label", "Parts");
    for (const item of manifest.labels) {
      const entry = document.createElement("li");
      entry.dataset.label = item.id;
      entry.textContent = item.text;
      key.append(entry);
    }
    root.append(key);
  }

  refresh();
  mount.replaceChildren(root);
  return { stage, values: { ...values }, destroy: () => root.remove() };
}
