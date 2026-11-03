import type { FaceDetector } from "@mediapipe/tasks-vision";
import { CaptureError } from "./messages";
import type { ProcessedImage } from "./processing";

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BlurResult {
  image: ProcessedImage;
  /** How many faces were hidden. */
  faces: number;
  /** False when the detector could not run, so the learner is asked to check for faces. */
  checked: boolean;
}

// Detections hug the eyes and mouth; the margin also hides hair, ears and chin.
const MARGIN = 0.35;
// So few blocks across a face that no feature survives, however the image is enhanced.
const BLOCKS_ACROSS = 6;
const QUALITY = 0.85;

/** Each detected face grown by a margin and kept inside the image, in whole pixels. */
export function faceRegions(boxes: FaceBox[], width: number, height: number): FaceBox[] {
  return boxes.map((box) => {
    const padX = box.width * MARGIN;
    const padY = box.height * MARGIN;
    const x = Math.max(0, Math.floor(box.x - padX));
    const y = Math.max(0, Math.floor(box.y - padY));
    return {
      x,
      y,
      width: Math.min(width, Math.ceil(box.x + box.width + padX)) - x,
      height: Math.min(height, Math.ceil(box.y + box.height + padY)) - y,
    };
  });
}

/** Replaces each region with a coarse mosaic of itself; canvas filters are missing in Safari. */
export function pixelate(context: CanvasRenderingContext2D, regions: FaceBox[]) {
  for (const region of regions) {
    const across = BLOCKS_ACROSS;
    const down = Math.max(1, Math.round((across * region.height) / Math.max(1, region.width)));
    const small = document.createElement("canvas");
    small.width = across;
    small.height = down;
    small
      .getContext("2d")
      ?.drawImage(
        context.canvas,
        region.x,
        region.y,
        region.width,
        region.height,
        0,
        0,
        across,
        down,
      );
    context.imageSmoothingEnabled = false;
    context.drawImage(small, 0, 0, across, down, region.x, region.y, region.width, region.height);
  }
}

let detector: Promise<FaceDetector> | undefined;

// Loaded only once a photo is chosen; the WebAssembly and model are served from this site.
function loadDetector(): Promise<FaceDetector> {
  detector ??= import("@mediapipe/tasks-vision").then(async ({ FaceDetector, FilesetResolver }) =>
    FaceDetector.createFromOptions(await FilesetResolver.forVisionTasks("/mediapipe/wasm"), {
      baseOptions: { modelAssetPath: "/mediapipe/blaze_face_short_range.tflite", delegate: "CPU" },
      runningMode: "IMAGE",
      minDetectionConfidence: 0.5,
    }),
  );
  // A failed load is retried with the next photo, not remembered.
  detector.catch(() => (detector = undefined));
  return detector;
}

function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new CaptureError("encodeFailed"))),
      "image/jpeg",
      QUALITY,
    );
  });
}

/** Hides every face the on-device detector finds, before the photo leaves the device (#69). */
export async function blurFaces(image: ProcessedImage): Promise<BlurResult> {
  let faces: FaceDetector;
  try {
    faces = await loadDetector();
  } catch {
    return { image, faces: 0, checked: false };
  }
  const bitmap = await createImageBitmap(image.blob);
  try {
    return await hide(faces, bitmap, image);
  } catch {
    return { image, faces: 0, checked: false };
  } finally {
    bitmap.close();
  }
}

async function hide(
  faces: FaceDetector,
  bitmap: ImageBitmap,
  image: ProcessedImage,
): Promise<BlurResult> {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) return { image, faces: 0, checked: false };
  context.drawImage(bitmap, 0, 0);
  const boxes = faces
    .detect(canvas)
    .detections.flatMap((detection) => (detection.boundingBox ? [detection.boundingBox] : []))
    .map((box) => ({ x: box.originX, y: box.originY, width: box.width, height: box.height }));
  if (boxes.length === 0) return { image, faces: 0, checked: true };
  pixelate(context, faceRegions(boxes, canvas.width, canvas.height));
  const blob = await encode(canvas);
  return {
    image: { blob, width: canvas.width, height: canvas.height, size: blob.size, type: blob.type },
    faces: boxes.length,
    checked: true,
  };
}
