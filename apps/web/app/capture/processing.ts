export interface NormaliseOptions {
  maxDimension?: number;
  quality?: number;
}

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  size: number;
  type: string;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DEFAULT_MAX_DIMENSION = 1600;
export const DEFAULT_JPEG_QUALITY = 0.85;

async function readBitmap(source: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(source);
  } catch {
    // Most often an HEIC file the browser cannot decode.
    throw new Error("This photo format cannot be read in your browser. Try JPG or PNG.");
  }
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the photo."))),
      "image/jpeg",
      quality,
    );
  });
}

function finish(canvas: HTMLCanvasElement, quality: number): Promise<ProcessedImage> {
  return encode(canvas, quality).then((blob) => ({
    blob,
    height: canvas.height,
    size: blob.size,
    type: blob.type,
    width: canvas.width,
  }));
}

// Downscaling keeps uploads small; JPEG output drops any metadata segments.
export async function normaliseImage(
  source: Blob,
  opts: NormaliseOptions = {},
): Promise<ProcessedImage> {
  const maxDimension = opts.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = opts.quality ?? DEFAULT_JPEG_QUALITY;
  const bitmap = await readBitmap(source);
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Photo processing is unavailable in this browser.");
    }
    context.drawImage(bitmap, 0, 0, width, height);
    return await finish(canvas, quality);
  } finally {
    bitmap.close();
  }
}

// Clamping keeps a partially-outside selection usable instead of rejecting it.
export async function cropImage(
  source: Blob,
  rect: CropRect,
  opts: NormaliseOptions = {},
): Promise<ProcessedImage> {
  if (!Number.isFinite(rect.x + rect.y + rect.width + rect.height)) {
    throw new Error("Crop values must be numbers.");
  }
  if (rect.width <= 0 || rect.height <= 0) {
    throw new Error("Choose a crop area with a positive width and height.");
  }
  const quality = opts.quality ?? DEFAULT_JPEG_QUALITY;
  const bitmap = await readBitmap(source);
  try {
    const x = Math.min(Math.max(0, Math.round(rect.x)), bitmap.width - 1);
    const y = Math.min(Math.max(0, Math.round(rect.y)), bitmap.height - 1);
    const width = Math.max(1, Math.min(Math.round(rect.width), bitmap.width - x));
    const height = Math.max(1, Math.min(Math.round(rect.height), bitmap.height - y));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Photo processing is unavailable in this browser.");
    }
    context.drawImage(bitmap, x, y, width, height, 0, 0, width, height);
    return await finish(canvas, quality);
  } finally {
    bitmap.close();
  }
}
