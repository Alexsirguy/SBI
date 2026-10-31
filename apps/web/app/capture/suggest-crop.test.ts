import { describe, expect, it } from "vitest";
import { suggestCrop } from "./suggest-crop";

// A plain backdrop with optional filled rectangles, as RGBA pixels.
function photo(
  width: number,
  height: number,
  boxes: { x: number; y: number; w: number; h: number; colour?: number[] }[] = [],
  backdrop = [240, 240, 240],
) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const box = boxes.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
      const [r, g, b] = box ? (box.colour ?? [40, 60, 90]) : backdrop;
      data.set([r ?? 0, g ?? 0, b ?? 0, 255], (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

describe("suggestCrop", () => {
  it("frames an object on a plain backdrop, with a little margin", () => {
    const rect = suggestCrop(photo(100, 80, [{ x: 30, y: 20, w: 40, h: 30 }]), 100, 80);
    expect(rect.x).toBeGreaterThanOrEqual(26);
    expect(rect.x).toBeLessThanOrEqual(30);
    expect(rect.y).toBeGreaterThanOrEqual(17);
    expect(rect.x + rect.width).toBeGreaterThanOrEqual(70);
    expect(rect.y + rect.height).toBeGreaterThanOrEqual(50);
    expect(rect.width).toBeLessThan(50);
  });

  it("scales the box from the sample up to the full photo", () => {
    const rect = suggestCrop(photo(100, 80, [{ x: 30, y: 20, w: 40, h: 30 }]), 1000, 800);
    expect(rect.x).toBeGreaterThanOrEqual(260);
    expect(rect.x + rect.width).toBeLessThanOrEqual(1000);
    expect(rect.width).toBeGreaterThan(400);
  });

  it("keeps the whole photo when the object fills it or nothing stands out", () => {
    expect(suggestCrop(photo(100, 80, [{ x: 2, y: 2, w: 96, h: 76 }]), 1000, 800)).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 800,
    });
    expect(suggestCrop(photo(100, 80), 1000, 800)).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 800,
    });
  });

  it("treats a gradient backdrop as backdrop, not as the object", () => {
    const pixels = photo(100, 80, [{ x: 30, y: 15, w: 40, h: 55 }]);
    // Light in the middle, darker towards the left and right edges, as in studio photos.
    for (let y = 0; y < 80; y += 1) {
      for (let x = 0; x < 100; x += 1) {
        const i = (y * 100 + x) * 4;
        if (pixels.data[i] === 240) {
          const shade = 255 - Math.abs(x - 50) * 1.6;
          pixels.data.set([shade, shade, shade], i);
        }
      }
    }
    const rect = suggestCrop(pixels, 100, 80);
    expect(rect.x).toBeGreaterThan(20);
    expect(rect.x + rect.width).toBeLessThan(80);
  });

  it("ignores specks too small to be the object", () => {
    const rect = suggestCrop(
      photo(100, 80, [
        { x: 40, y: 30, w: 20, h: 20 },
        { x: 2, y: 70, w: 1, h: 1 },
      ]),
      100,
      80,
    );
    expect(rect.y).toBeGreaterThan(20);
    expect(rect.x).toBeGreaterThan(30);
  });
});
