import { describe, expect, it } from "vitest";
import { faceRegions } from "./face-blur";

describe("faceRegions", () => {
  it("grows each face by a margin so hair, ears and chin are hidden too", () => {
    expect(faceRegions([{ x: 100, y: 100, width: 100, height: 100 }], 1000, 1000)).toEqual([
      { x: 65, y: 65, width: 170, height: 170 },
    ]);
  });

  it("keeps a face at the edge inside the photo", () => {
    expect(faceRegions([{ x: 0, y: 950, width: 80, height: 80 }], 1000, 1000)).toEqual([
      { x: 0, y: 922, width: 108, height: 78 },
    ]);
  });
});
