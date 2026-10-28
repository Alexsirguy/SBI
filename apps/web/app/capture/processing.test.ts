import { describe, expect, it } from "vitest";
import { clampCrop, fitWithin, moveCrop } from "./processing";

describe("fitWithin", () => {
  it("scales the longest side down to the cap and keeps the aspect ratio", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ height: 1200, width: 1600 });
    expect(fitWithin(1000, 3000, 1600)).toEqual({ height: 1600, width: 533 });
  });

  it("never upscales a small photo", () => {
    expect(fitWithin(640, 480, 1600)).toEqual({ height: 480, width: 640 });
  });
});

describe("clampCrop", () => {
  it("rounds and keeps a selection that is already inside the image", () => {
    expect(clampCrop({ height: 50.4, width: 100.6, x: 10.2, y: 20.7 }, 800, 600)).toEqual({
      height: 50,
      width: 101,
      x: 10,
      y: 21,
    });
  });

  it("trims a selection that extends past the image edges", () => {
    expect(clampCrop({ height: 900, width: 900, x: -20, y: 500 }, 800, 600)).toEqual({
      height: 100,
      width: 800,
      x: 0,
      y: 500,
    });
  });

  it("keeps at least one pixel so the result can always be encoded", () => {
    expect(clampCrop({ height: 0.2, width: 5, x: 900, y: 0 }, 800, 600)).toEqual({
      height: 1,
      width: 1,
      x: 799,
      y: 0,
    });
  });
});

describe("moveCrop", () => {
  it("stops at the image edge instead of shrinking the selection", () => {
    const rect = { height: 100, width: 200, x: 500, y: 400 };
    expect(moveCrop(rect, 300, 300, 800, 600)).toEqual({ height: 100, width: 200, x: 600, y: 500 });
    expect(moveCrop(rect, -900, -900, 800, 600)).toEqual({ height: 100, width: 200, x: 0, y: 0 });
  });
});
