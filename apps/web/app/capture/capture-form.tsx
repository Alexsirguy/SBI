"use client";

import { useEffect, useId, useRef, useState } from "react";
import { webEnv } from "../../env";
import { CropBox } from "./crop-box";
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_FORMATS_LABEL,
  formatBytes,
  uploadLimitLabel,
  validateSelection,
} from "./limits";
import { cropImage, normaliseImage, type CropRect, type ProcessedImage } from "./processing";
import { assessQuality, readImageData, type QualityReport } from "./quality";

const CHECK_LABELS = { exposure: "Exposure", sharpness: "Sharpness", subject: "Object size" };

const CROP_FIELDS = [
  { key: "x", label: "Left (px)" },
  { key: "y", label: "Top (px)" },
  { key: "width", label: "Width (px)" },
  { key: "height", label: "Height (px)" },
] as const;

function describe(image: ProcessedImage): string {
  const format = image.type === "image/jpeg" || image.type === "" ? "JPEG" : image.type;
  return `${image.width} by ${image.height} pixels, ${format} (${formatBytes(image.size)})`;
}

function fullFrame(image: ProcessedImage): CropRect {
  return { height: image.height, width: image.width, x: 0, y: 0 };
}

export function CaptureForm() {
  const limits = webEnv.capture;
  const cameraId = useId();
  const uploadId = useId();
  const problemId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  // Bumped on every new selection so a slow earlier decode cannot overwrite a newer photo.
  const runRef = useRef(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [original, setOriginal] = useState<ProcessedImage | null>(null);
  const [prepared, setPrepared] = useState<ProcessedImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [quality, setQuality] = useState<QualityReport | null>(null);

  // Guidance only: a failed check never blocks uploading.
  async function assess(image: ProcessedImage) {
    try {
      const bitmap = await createImageBitmap(image.blob);
      try {
        setQuality(assessQuality(readImageData(bitmap)));
      } finally {
        bitmap.close();
      }
    } catch {
      setQuality(null);
    }
  }

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function clear() {
    runRef.current += 1;
    setFileName(null);
    setProblem(null);
    setBusy(false);
    setOriginal(null);
    setPrepared(null);
    setPreviewUrl(null);
    setCrop(null);
    setQuality(null);
  }

  function retake() {
    clear();
    for (const input of [cameraRef.current, uploadRef.current]) {
      if (input) {
        input.value = "";
      }
    }
    cameraRef.current?.focus();
  }

  async function choose(input: HTMLInputElement) {
    const selected = input.files?.[0];
    if (!selected) {
      return;
    }
    clear();
    const run = runRef.current;
    setFileName(selected.name);
    const issue = validateSelection(selected, limits.maxUploadBytes);
    if (issue) {
      setProblem(issue);
      return;
    }
    setBusy(true);
    try {
      const image = await normaliseImage(selected, limits);
      if (run !== runRef.current) {
        return;
      }
      await assess(image);
      setOriginal(image);
      setPrepared(image);
      setPreviewUrl(URL.createObjectURL(image.blob));
      setCrop(fullFrame(image));
    } catch (error) {
      if (run === runRef.current) {
        setProblem(error instanceof Error ? error.message : "Could not read that photo.");
      }
    } finally {
      if (run === runRef.current) {
        setBusy(false);
      }
    }
  }

  async function applyCrop() {
    if (!original || !crop) {
      return;
    }
    const run = runRef.current;
    setBusy(true);
    setProblem(null);
    try {
      // Always crop the normalised original so repeated crops do not recompress the JPEG.
      const image = await cropImage(original.blob, crop, limits);
      if (run === runRef.current) {
        setPrepared(image);
        await assess(image);
      }
    } catch (error) {
      if (run === runRef.current) {
        setProblem(error instanceof Error ? error.message : "Could not crop that photo.");
      }
    } finally {
      if (run === runRef.current) {
        setBusy(false);
      }
    }
  }

  function setField(key: keyof CropRect, value: number) {
    setCrop((current) => (current ? { ...current, [key]: value } : current));
  }

  const status = problem
    ? null
    : busy
      ? "Preparing your photo…"
      : prepared
        ? `Ready: ${describe(prepared)}.`
        : fileName
          ? `Selected ${fileName}.`
          : null;

  return (
    <form aria-label="Photo capture" onSubmit={(event) => event.preventDefault()}>
      <div>
        <label htmlFor={cameraId}>Take a photo</label>
        <input
          id={cameraId}
          ref={cameraRef}
          name="camera"
          type="file"
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? problemId : undefined}
          accept="image/*"
          capture="environment"
          onChange={(event) => void choose(event.currentTarget)}
        />
      </div>
      <div>
        <label htmlFor={uploadId}>Upload a photo</label>
        <input
          id={uploadId}
          ref={uploadRef}
          name="upload"
          type="file"
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? problemId : undefined}
          accept={ACCEPTED_EXTENSIONS}
          onChange={(event) => void choose(event.currentTarget)}
        />
      </div>
      <p>
        Accepted formats: {ACCEPTED_FORMATS_LABEL}. Maximum size:{" "}
        {uploadLimitLabel(limits.maxUploadBytes)}.
      </p>
      <div role="alert" id={problemId}>
        {problem}
      </div>
      <div role="status">{status ? <p>{status}</p> : null}</div>
      {original && previewUrl && crop ? (
        <fieldset>
          <legend>Crop (optional)</legend>
          <CropBox
            src={previewUrl}
            imageWidth={original.width}
            imageHeight={original.height}
            rect={crop}
            onChange={setCrop}
          />
          {CROP_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label htmlFor={`${uploadId}-crop-${key}`}>{label}</label>
              <input
                id={`${uploadId}-crop-${key}`}
                type="number"
                min={key === "width" || key === "height" ? 1 : 0}
                max={key === "x" || key === "width" ? original.width : original.height}
                value={crop[key]}
                onChange={(event) => setField(key, event.currentTarget.valueAsNumber)}
              />
            </div>
          ))}
          <button type="button" onClick={() => setCrop(fullFrame(original))} disabled={busy}>
            Reset crop
          </button>
          <button type="button" onClick={() => void applyCrop()} disabled={busy}>
            Apply crop
          </button>
          <button type="button" onClick={retake}>
            Retake or choose another
          </button>
        </fieldset>
      ) : null}
      {prepared && !busy ? (
        <section aria-label="Photo check">
          <h2>Photo check</h2>
          {quality ? (
            <ul>
              {quality.checks.map((check) => (
                <li key={check.id}>
                  {check.passed
                    ? `${CHECK_LABELS[check.id]}: good`
                    : (check.guidance ?? "Retake the photo.")}
                </li>
              ))}
            </ul>
          ) : (
            <p>Photo checks could not run — you can still upload.</p>
          )}
        </section>
      ) : null}
      <button type="submit" disabled={!prepared || busy}>
        Upload photo
      </button>
    </form>
  );
}
