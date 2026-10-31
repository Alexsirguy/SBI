import type { VisualManifest } from "@sbi/contracts";
import { compileFormula } from "../formula";

/** Problems with the layer every kind shares, worded so the AI can repair them. */
export function commonLayerProblems(manifest: VisualManifest): string[] {
  const problems: string[] = [];
  const ids = [...manifest.labels, ...manifest.controls, ...manifest.readouts].map(
    (item) => item.id,
  );
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) problems.push(`the id "${duplicate}" is used more than once`);
  for (const control of manifest.controls) {
    const steps = (control.max - control.min) / control.step;
    if (steps > 1000) problems.push(`control "${control.id}" has more than 1000 steps`);
  }
  const names = manifest.controls.map((control) => control.id);
  const scope = Object.fromEntries(manifest.controls.map((control) => [control.id, control.value]));
  for (const readout of manifest.readouts) {
    const compiled = compileFormula(readout.formula, names);
    if ("error" in compiled) {
      problems.push(`readout "${readout.id}": ${compiled.error}`);
      continue;
    }
    // Every slider's ends as well as its start, so a readout cannot blow up when moved.
    for (const control of manifest.controls) {
      for (const value of [control.min, control.value, control.max]) {
        try {
          compiled.evaluate({ ...scope, [control.id]: value });
        } catch (error) {
          problems.push(
            `readout "${readout.id}" with ${control.id} = ${value}: ${(error as Error).message}`,
          );
          break;
        }
      }
    }
    if (manifest.controls.length === 0) {
      try {
        compiled.evaluate(scope);
      } catch (error) {
        problems.push(`readout "${readout.id}": ${(error as Error).message}`);
      }
    }
  }
  return problems;
}
