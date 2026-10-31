import type { CropRect } from "./processing";
import type { PixelData } from "./quality";

// How far a pixel's colour must sit from the backdrop to count as part of the object.
const DEVIATION = 40;
// A row or column needs this share of object pixels, so specks and noise do not stretch the box.
const LINE_SHARE = 0.03;
const MARGIN = 0.1;
// A box this close to the whole photo is the whole photo: busy scenes and close-ups.
const WHOLE_SHARE = 0.85;

function fullFrame(width: number, height: number): CropRect {
  return { x: 0, y: 0, width, height };
}

/** Where the object probably is: what stands out from the photo's edges, with a little margin. */
export function suggestCrop(pixels: PixelData, imageWidth: number, imageHeight: number): CropRect {
  const { data, width, height } = pixels;
  if (width < 3 || height < 3) return fullFrame(imageWidth, imageHeight);

  // The backdrop is estimated from the nearest edges, so gradients and vignettes are not objects.
  const channel = (x: number, y: number, c: number) => data[(y * width + x) * 4 + c] ?? 0;
  const backdrop = (x: number, y: number, c: number) => {
    const across =
      (channel(0, y, c) * (width - 1 - x) + channel(width - 1, y, c) * x) / (width - 1);
    const down =
      (channel(x, 0, c) * (height - 1 - y) + channel(x, height - 1, c) * y) / (height - 1);
    return (across + down) / 2;
  };

  const columns = new Uint32Array(width);
  const rows = new Uint32Array(height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const distance = Math.max(
        Math.abs(channel(x, y, 0) - backdrop(x, y, 0)),
        Math.abs(channel(x, y, 1) - backdrop(x, y, 1)),
        Math.abs(channel(x, y, 2) - backdrop(x, y, 2)),
      );
      if (distance > DEVIATION) {
        columns[x] = (columns[x] ?? 0) + 1;
        rows[y] = (rows[y] ?? 0) + 1;
      }
    }
  }
  const spans = (counts: Uint32Array, length: number) => {
    const first = counts.findIndex((count) => count > length * LINE_SHARE);
    const last = counts.findLastIndex((count) => count > length * LINE_SHARE);
    return first < 0 ? null : [first, last + 1];
  };
  const across = spans(columns, height);
  const down = spans(rows, width);
  if (!across || !down) return fullFrame(imageWidth, imageHeight);

  const [left, right] = across as [number, number];
  const [top, bottom] = down as [number, number];
  const padX = (right - left) * MARGIN;
  const padY = (bottom - top) * MARGIN;
  const x0 = Math.max(0, left - padX);
  const y0 = Math.max(0, top - padY);
  const x1 = Math.min(width, right + padX);
  const y1 = Math.min(height, bottom + padY);
  if (((x1 - x0) * (y1 - y0)) / (width * height) >= WHOLE_SHARE) {
    return fullFrame(imageWidth, imageHeight);
  }

  const sx = imageWidth / width;
  const sy = imageHeight / height;
  const x = Math.round(x0 * sx);
  const y = Math.round(y0 * sy);
  return {
    x,
    y,
    width: Math.min(imageWidth - x, Math.round((x1 - x0) * sx)),
    height: Math.min(imageHeight - y, Math.round((y1 - y0) * sy)),
  };
}
