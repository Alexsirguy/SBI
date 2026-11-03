import { describe, expect, it } from "vitest";
import { describeShow, showContext, validateVisualAction, type DraftShow } from "./show";
import { LESSON, MANIFEST } from "./test-lesson";

const show = showContext(LESSON, MANIFEST);
const draft = (overrides: Partial<DraftShow>): DraftShow => ({
  settings: [],
  step: null,
  highlight: null,
  ...overrides,
});

describe("validateVisualAction", () => {
  it("keeps known sliders within range, snapped to the slider's step", () => {
    expect(
      validateVisualAction(draft({ settings: [{ control: "altitude", value: 4430 }] }), show),
    ).toEqual({
      visualId: MANIFEST.visualId,
      settings: [{ controlId: "altitude", value: 4400 }],
    });
  });

  it("drops unknown sliders, out-of-range values and unknown parts", () => {
    const action = draft({
      settings: [
        { control: "temperature", value: 50 },
        { control: "altitude", value: 9000 },
      ],
      highlight: "lid",
    });
    expect(validateVisualAction(action, show)).toBeUndefined();
  });

  it("plays a demonstration step with its own settings, numbered from 1", () => {
    const action = validateVisualAction(
      draft({ step: 2, settings: [{ control: "altitude", value: 100 }] }),
      show,
    );
    expect(action).toEqual({
      visualId: MANIFEST.visualId,
      settings: [{ controlId: "altitude", value: 5000 }],
      step: 1,
    });
    expect(validateVisualAction(draft({ step: 7 }), show)).toBeUndefined();
  });

  it("highlights a part the manifest names", () => {
    expect(validateVisualAction(draft({ highlight: "strip" }), show)).toEqual({
      visualId: MANIFEST.visualId,
      settings: [],
      highlight: "strip",
    });
  });

  it("does nothing when the lesson has no visual to move", () => {
    expect(validateVisualAction(draft({ highlight: "strip" }), undefined)).toBeUndefined();
    expect(showContext(LESSON, { ...MANIFEST, controls: [], labels: [] })).toBeUndefined();
  });

  it("lists every slider, step and part by the ids the model must use", () => {
    const text = show ? describeShow(show) : "";
    expect(text).toContain("altitude (Height, 0 to 8000 m)");
    expect(text).toContain("2. Climb a high mountain.");
    expect(text).toContain("strip (Bimetallic strip)");
  });
});
