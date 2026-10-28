"use client";

import { useId, useRef, useState } from "react";
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_FORMATS_LABEL,
  MAX_UPLOAD_LABEL,
  formatBytes,
  validateSelection,
} from "./limits";
import { cropImage, normaliseImage, type ProcessedImage } from "./processing";

interface CropFields {
  x: string;
  y: string;
  width: string;
  height: string;
}

const EMPTY_CROP: CropFields = { height: "", width: "", x: "", y: "" };

function describe(image: ProcessedImage): string {
  return `${image.width} by ${image.height} pixels, ${image.type || "JPEG"} (${formatBytes(image.size)})`;
}

export function CaptureForm() {
  const cameraId = useId();
  const uploadId = useId();
  const problemId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prepared, setPrepared] = useState<ProcessedImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropFields>(EMPTY_CROP);

  function reset() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    if (cameraRef.current) {
      cameraRef.current.value = "";
    }
    if (uploadRef.current) {
      uploadRef.current.value = "";
    }
    setFileName(null);
    setProblem(null);
    setBusy(false);
    setPrepared(null);
    setPreviewUrl(null);
    setCrop(EMPTY_CROP);
  }

  async function choose(input: HTMLInputElement) {
    const selected = input.files?.[0];
    if (!selected) {
      return;
    }
    reset();
    const issue = validateSelection(selected);
    if (issue) {
      setProblem(issue);
      setFileName(selected.name);
      return;
    }
    setFileName(selected.name);
    setBusy(true);
    try {
      const image = await normaliseImage(selected);
      setPrepared(image);
      setPreviewUrl(URL.createObjectURL(image.blob));
      setCrop({ height: String(image.height), width: String(image.width), x: "0", y: "0" });
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Could not read that photo.");
    } finally {
      setBusy(false);
    }
  }

  async function applyCrop() {
    if (!prepared) {
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const image = await cropImage(prepared.blob, {
        height: Number(crop.height),
        width: Number(crop.width),
        x: Number(crop.x),
        y: Number(crop.y),
      });
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPrepared(image);
      setPreviewUrl(URL.createObjectURL(image.blob));
      setCrop({ height: String(image.height), width: String(image.width), x: "0", y: "0" });
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Could not crop that photo.");
    } finally {
      setBusy(false);
    }
  }

  function setField(name: keyof CropFields, value: string) {
    setCrop((current) => ({ ...current, [name]: value }));
  }

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
        Accepted formats: {ACCEPTED_FORMATS_LABEL}. Maximum size: {MAX_UPLOAD_LABEL}.
      </p>
      <div role="alert" id={problemId}>
        {problem}
      </div>
      <div role="status">
        {!problem && busy ? <p>Preparing your photo…</p> : null}
        {!problem && !busy && fileName && !prepared ? <p>Selected {fileName}.</p> : null}
        {prepared ? <p>Ready: {describe(prepared)}.</p> : null}
      </div>
      {previewUrl ? (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Preview of the photo to upload" src={previewUrl} width={320} />
        </div>
      ) : null}
      {prepared ? (
        <fieldset>
          <legend>Crop (optional, in pixels)</legend>
          {(["x", "y", "width", "height"] as const).map((name) => (
            <div key={name}>
              <label htmlFor={`${uploadId}-crop-${name}`}>{name}</label>
              <input
                id={`${uploadId}-crop-${name}`}
                inputMode="numeric"
                value={crop[name]}
                onChange={(event) => setField(name, event.target.value)}
              />
            </div>
          ))}
          <button type="button" onClick={() => void applyCrop()} disabled={busy}>
            Apply crop
          </button>
          <button type="button" onClick={reset}>
            Retake or choose another
          </button>
        </fieldset>
      ) : null}
      <button type="submit" disabled={!prepared || busy}>
        Upload photo
      </button>
    </form>
  );
}
