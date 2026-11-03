// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createExperimentController, visualSliderId } from "./experiment";
import { format } from "../i18n/format";
import en from "../i18n/messages/en";
import { goalHint as hint, goalMet } from "./goal";
import type { LessonT } from "./lesson-t";
import { SAMPLE_MERRILL_MANIFEST } from "./sample-merrill-lesson";

// The same slider the visual's common layer draws, so the controller is driven as in the app.
function drawSlider() {
  const figure = document.body.appendChild(document.createElement("figure"));
  const input = figure.appendChild(document.createElement("input"));
  Object.assign(input, {
    type: "range",
    id: visualSliderId(SAMPLE_MERRILL_MANIFEST.visualId, "tension"),
    min: "40",
    max: "200",
    step: "5",
    value: "110",
  });
  return input;
}

afterEach(() => document.body.replaceChildren());

describe("createExperimentController", () => {
  it("knows which controls and readouts the visual offers", () => {
    const controller = createExperimentController(SAMPLE_MERRILL_MANIFEST);
    expect(controller.has({ controls: ["tension"], readouts: ["pitch"] })).toBe(true);
    expect(controller.has({ controls: ["length"] })).toBe(false);
    expect(controller.has({ readouts: ["loudness"] })).toBe(false);
  });

  it("moves the slider as a learner would, clamped to its range, and tells subscribers", () => {
    const input = drawSlider();
    const heard = vi.fn();
    input.addEventListener("input", heard);
    const controller = createExperimentController(SAMPLE_MERRILL_MANIFEST);
    const listener = vi.fn();
    const stop = controller.subscribe(listener);

    expect(controller.set("tension", 500)).toBe(true);
    expect(input.value).toBe("200");
    expect(heard).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(controller.values()).toEqual({ tension: 200 });

    stop();
    controller.set("tension", 160);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("works readouts out with the manifest's own formula", () => {
    drawSlider();
    const controller = createExperimentController(SAMPLE_MERRILL_MANIFEST);
    expect(controller.readout("pitch")).toBeCloseTo(147.3, 1);
    controller.set("tension", 165);
    expect(controller.readout("pitch")).toBeCloseTo(180.4, 1);
    expect(controller.readout("loudness")).toBeUndefined();
  });

  it("uses the manifest's starting values, and cannot set anything, before the visual is drawn", () => {
    const controller = createExperimentController(SAMPLE_MERRILL_MANIFEST);
    expect(controller.values()).toEqual({ tension: 110 });
    expect(controller.set("tension", 160)).toBe(false);
  });
});

describe("goals", () => {
  const t: LessonT = (key, values) => format(en.lesson[key], values);
  const goalHint = (...args: [Parameters<typeof hint>[0], number, typeof pitch]) =>
    hint(...args, t, "en");
  const pitch = { label: "Pitch", unit: "Hz" };

  it("checks at least, at most and near", () => {
    expect(goalMet({ readoutId: "pitch", op: "atLeast", value: 180 }, 180)).toBe(true);
    expect(goalMet({ readoutId: "pitch", op: "atMost", value: 180 }, 181)).toBe(false);
    expect(goalMet({ readoutId: "pitch", op: "near", value: 147, tolerance: 5 }, 151)).toBe(true);
    expect(goalMet({ readoutId: "pitch", op: "near", value: 147, tolerance: 5 }, 153)).toBe(false);
  });

  it("coaches in plain words, never rounding a miss up to the goal", () => {
    expect(goalHint({ readoutId: "pitch", op: "atLeast", value: 180 }, 160, pitch)).toBe(
      "Pitch is 160 Hz; you need at least 180 Hz.",
    );
    expect(goalHint({ readoutId: "pitch", op: "atLeast", value: 180 }, 179.96, pitch)).toBe(
      "Pitch is 179.96 Hz; you need at least 180 Hz.",
    );
    expect(
      goalHint({ readoutId: "pitch", op: "near", value: 147, tolerance: 5 }, 189.2, pitch),
    ).toBe("Pitch is 189.2 Hz; you need about 147 Hz, within 5 Hz.");
  });

  it("marks one part of the visual's key for the tutor's watch, and clears it", () => {
    const manifest = {
      ...SAMPLE_MERRILL_MANIFEST,
      labels: [
        { id: "string", text: "String", claimId: "0192f1a0-0000-7000-8000-000000000001" },
        { id: "peg", text: "Peg", claimId: "0192f1a0-0000-7000-8000-000000000001" },
      ],
    };
    const figure = drawSlider().closest("figure");
    const key = figure?.appendChild(document.createElement("ol"));
    for (const id of ["string", "peg"]) {
      const part = key?.appendChild(document.createElement("li"));
      if (part) part.dataset.label = id;
    }
    const controller = createExperimentController(manifest);
    const marked = () =>
      [...document.querySelectorAll<HTMLElement>("[data-highlighted]")].map(
        (part) => part.dataset.label,
      );
    expect(controller.highlight("peg")).toBe(true);
    expect(marked()).toEqual(["peg"]);
    expect(controller.highlight("lid")).toBe(false);
    expect(marked()).toEqual([]);
    controller.highlight("string");
    expect(controller.highlight(undefined)).toBe(true);
    expect(marked()).toEqual([]);
  });
});
