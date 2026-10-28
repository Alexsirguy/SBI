import { describe, expect, it } from "vitest";
import { assessQuality, type PixelData } from "./quality";

function image(width: number, height: number, shade: (x: number, y: number) => number): PixelData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = shade(x, y);
      data.set([value, value, value, 255], (y * width + x) * 4);
    }
  }
  return { data, height, width };
}

const checker = (x: number, y: number) => ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? 30 : 220);
// A sharp-edged object on a plain backdrop, the shape most lesson photos have.
const object = (x: number, y: number) =>
  x > 100 && x < 300 && y > 60 && y < 240 ? checker(x, y) : 128;

function failed(report: ReturnType<typeof assessQuality>) {
  return report.checks.filter((check) => !check.passed).map((check) => check.id);
}

describe("assessQuality", () => {
  it("passes a sharp, well-exposed, well-framed photo", () => {
    expect(failed(assessQuality(image(400, 300, object)))).toEqual([]);
  });

  it("flags a featureless photo as blurry with no object", () => {
    const report = assessQuality(image(400, 300, () => 128));
    expect(failed(report)).toEqual(["sharpness", "subject"]);
    expect(report.checks.find((check) => check.id === "sharpness")?.guidance).toMatch(
      /Hold the camera still/,
    );
  });

  it("flags a soft gradient as blurry even though it is not flat", () => {
    expect(failed(assessQuality(image(400, 300, (x) => 60 + x / 4)))).toContain("sharpness");
  });

  it("tells the learner whether the photo is too dark or too bright", () => {
    const dark = assessQuality(image(400, 300, (x, y) => object(x, y) / 8));
    const bright = assessQuality(image(400, 300, (x, y) => 235 + object(x, y) / 20));
    expect(dark.checks.find((check) => check.id === "exposure")?.guidance).toMatch(/too dark/);
    expect(bright.checks.find((check) => check.id === "exposure")?.guidance).toMatch(/too bright/);
  });

  it("asks the learner to move closer when the object is tiny", () => {
    const tiny = (x: number, y: number) => (x > 195 && x < 205 && y > 145 && y < 155 ? 0 : 128);
    expect(failed(assessQuality(image(400, 300, tiny)))).toContain("subject");
  });

  it("flags a photo whose source resolution is too low to recognise", () => {
    const report = assessQuality(image(400, 300, object), {}, { height: 90, width: 120 });
    expect(failed(report)).toEqual(["resolution"]);
    expect(report.checks.find((check) => check.id === "resolution")?.guidance).toMatch(/too small/);
  });

  it("honours custom thresholds", () => {
    expect(failed(assessQuality(image(400, 300, object), { luminanceMaximum: 100 }))).toContain(
      "exposure",
    );
  });
});
