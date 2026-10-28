export type QualityCheckId = "sharpness" | "exposure" | "subject";

export interface QualityCheck {
  id: QualityCheckId;
  passed: boolean;
  guidance: string | null;
}

export interface QualityReport {
  checks: QualityCheck[];
}

export interface QualityThresholds {
  blurVarianceMinimum?: number;
  luminanceMaximum?: number;
  luminanceMinimum?: number;
  subjectFractionMinimum?: number;
}

const BLUR_VARIANCE_MINIMUM = 25;
const LUMINANCE_MINIMUM = 40;
const LUMINANCE_MAXIMUM = 215;
const SUBJECT_FRACTION_MINIMUM = 0.15;
const SUBJECT_DEVIATION = 30;

function luminance(data: Uint8ClampedArray, i: number): number {
  return 0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);
}

function at(grid: Float64Array, i: number): number {
  return grid[i] ?? 0;
}

// Heuristics run fully on-device; they advise the learner, never block uploading.
export function assessQuality(image: ImageData, thresholds: QualityThresholds = {}): QualityReport {
  const { height, width } = image;
  const lum = new Float64Array(width * height);
  let mean = 0;
  for (let p = 0; p < lum.length; p += 1) {
    const value = luminance(image.data, p * 4);
    lum[p] = value;
    mean += value;
  }
  mean /= lum.length;

  let laplacianMean = 0;
  let laplacianSquares = 0;
  let laplacianCount = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const lap =
        -4 * at(lum, y * width + x) +
        at(lum, (y - 1) * width + x) +
        at(lum, (y + 1) * width + x) +
        at(lum, y * width + (x - 1)) +
        at(lum, y * width + (x + 1));
      laplacianMean += lap;
      laplacianSquares += lap * lap;
      laplacianCount += 1;
    }
  }
  const average = laplacianCount === 0 ? 0 : laplacianMean / laplacianCount;
  const variance = laplacianCount === 0 ? 0 : laplacianSquares / laplacianCount - average * average;

  // Border pixels approximate the backdrop; the subject is what differs from it.
  let borderSum = 0;
  let borderCount = 0;
  for (let x = 0; x < width; x += 1) {
    borderSum += at(lum, x) + at(lum, (height - 1) * width + x);
    borderCount += 2;
  }
  for (let y = 1; y < height - 1; y += 1) {
    borderSum += at(lum, y * width) + at(lum, y * width + (width - 1));
    borderCount += 2;
  }
  const backdrop = borderCount === 0 ? mean : borderSum / borderCount;
  let subject = 0;
  for (let p = 0; p < lum.length; p += 1) {
    if (Math.abs(at(lum, p) - backdrop) > SUBJECT_DEVIATION) {
      subject += 1;
    }
  }
  const subjectFraction = lum.length === 0 ? 0 : subject / lum.length;

  const blurMinimum = thresholds.blurVarianceMinimum ?? BLUR_VARIANCE_MINIMUM;
  const low = thresholds.luminanceMinimum ?? LUMINANCE_MINIMUM;
  const high = thresholds.luminanceMaximum ?? LUMINANCE_MAXIMUM;
  const subjectMinimum = thresholds.subjectFractionMinimum ?? SUBJECT_FRACTION_MINIMUM;

  const checks: QualityCheck[] = [
    {
      guidance:
        variance < blurMinimum
          ? "The photo looks blurry or very plain. Hold the camera still and retake it."
          : null,
      id: "sharpness",
      passed: variance >= blurMinimum,
    },
    {
      guidance:
        mean < low
          ? "The photo is too dark. Move into better light and retake it."
          : mean > high
            ? "The photo is too bright. Avoid direct glare and retake it."
            : null,
      id: "exposure",
      passed: mean >= low && mean <= high,
    },
    {
      guidance:
        subjectFraction < subjectMinimum
          ? "The object looks small or missing. Move closer so it fills the frame."
          : null,
      id: "subject",
      passed: subjectFraction >= subjectMinimum,
    },
  ];
  return { checks };
}

export function qualityGuidance(report: QualityReport): string[] {
  return report.checks.flatMap((check) => (check.guidance ? [check.guidance] : []));
}

export function readImageData(source: ImageBitmap, maxDimension = 240): ImageData {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, maxDimension / Math.max(source.width, source.height, 1));
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Photo checks are unavailable in this browser.");
  }
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
