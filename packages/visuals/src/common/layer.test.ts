// @vitest-environment happy-dom
import { VisualManifest } from "@sbi/contracts";
import { describe, expect, it, vi } from "vitest";
import { mountCommonLayer } from "./layer";
import { commonLayerProblems } from "./validate";

const CLAIM = "0192f1a0-0000-7000-8000-000000000101";

const manifest = VisualManifest.parse({
  visualId: "0192f1a0-0000-7000-8000-00000000002a",
  kind: "graph",
  alt: "Kettle temperature",
  fallback: { text: "The water warms, then boils." },
  labels: [{ id: "element", text: "Heating element", claimId: CLAIM }],
  controls: [
    { id: "power", label: "Heater power", unit: "W", min: 500, max: 3000, step: 100, value: 2000 },
    { id: "mass", label: "Water", unit: "kg", min: 0.2, max: 1.7, step: 0.1, value: 1 },
  ],
  readouts: [
    { id: "timeToBoil", label: "Time to boil", unit: "s", formula: "mass * 4190 * 80 / power" },
  ],
});

describe("mountCommonLayer", () => {
  it("gives every slider a label, its value with the unit, and its range", () => {
    const mount = document.body.appendChild(document.createElement("div"));
    mountCommonLayer(manifest, mount, () => undefined);
    const slider = mount.querySelector<HTMLInputElement>('input[type="range"]');
    expect(slider?.labels?.[0]?.textContent).toBe("Heater power");
    expect(slider?.getAttribute("aria-valuetext")).toBe("2,000 W");
    expect([slider?.min, slider?.max, slider?.step]).toEqual(["500", "3000", "100"]);
  });

  it("works out readouts from the sliders and updates them as a slider moves", () => {
    const mount = document.body.appendChild(document.createElement("div"));
    const onChange = vi.fn();
    mountCommonLayer(manifest, mount, onChange);
    const readout = mount.querySelector("dd output");
    expect(readout?.textContent).toBe("168 s");

    const slider = mount.querySelector<HTMLInputElement>('input[type="range"]');
    if (!slider) throw new Error("no slider");
    slider.value = "1000";
    slider.dispatchEvent(new Event("input"));

    expect(readout?.textContent).toBe("335 s");
    expect(slider.getAttribute("aria-valuetext")).toBe("1,000 W");
    expect(onChange).toHaveBeenCalledWith({ power: 1000, mass: 1 });
  });

  it("lists labels as a numbered key beside the stage", () => {
    const mount = document.body.appendChild(document.createElement("div"));
    const layer = mountCommonLayer(manifest, mount, () => undefined);
    expect(mount.querySelector('ol[aria-label="Parts"] li')?.textContent).toBe("Heating element");
    expect(layer.stage.isConnected).toBe(true);
    layer.destroy();
    expect(mount.childNodes).toHaveLength(0);
  });
});

describe("commonLayerProblems", () => {
  it("passes a sound layer", () => {
    expect(commonLayerProblems(manifest)).toEqual([]);
  });

  it("finds repeated ids, unknown names and readouts that blow up at a slider's end", () => {
    const broken = VisualManifest.parse({
      ...manifest,
      labels: [{ id: "power", text: "Power", claimId: CLAIM }],
      readouts: [
        { id: "speed", label: "Speed", formula: "power / (mass - 0.2)" },
        { id: "force", label: "Force", formula: "mass * gravity" },
      ],
    });
    const problems = commonLayerProblems(broken);
    expect(problems).toContain('the id "power" is used more than once');
    expect(problems.some((p) => p.includes('readout "speed" with mass = 0.2'))).toBe(true);
    expect(problems.some((p) => p.includes('unknown name "gravity"'))).toBe(true);
  });
});
