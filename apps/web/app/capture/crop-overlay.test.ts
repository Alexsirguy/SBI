import { describe, expect, it } from "vitest";
import { resizeFromCorner } from "./crop-overlay";

const start = { x: 100, y: 100, width: 400, height: 300 };

describe("resizeFromCorner", () => {
  it("keeps the opposite corner fixed", () => {
    expect(resizeFromCorner(start, "nw", -50, -20, 1000, 800)).toEqual({
      x: 50,
      y: 80,
      width: 450,
      height: 320,
    });
    expect(resizeFromCorner(start, "se", 50, 20, 1000, 800)).toEqual({
      x: 100,
      y: 100,
      width: 450,
      height: 320,
    });
  });

  it("stays inside the photo", () => {
    expect(resizeFromCorner(start, "ne", 5000, -5000, 1000, 800)).toEqual({
      x: 100,
      y: 0,
      width: 900,
      height: 400,
    });
  });

  it("never shrinks below a tenth of the photo", () => {
    const rect = resizeFromCorner(start, "sw", 5000, -5000, 1000, 800);
    expect(rect.width).toBe(100);
    expect(rect.height).toBe(80);
  });
});
