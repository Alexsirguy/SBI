"use client";

import { useEffect, useId, useRef, useState } from "react";
import { webEnv } from "../../env";
import { CameraView } from "./camera-view";
import { CropBox } from "./crop-box";
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_FORMATS_LABEL,
  formatBytes,
  uploadLimitLabel,
  validateSelection,
} from "./limits";
import {
  cropImage,
  normaliseImage,
  stripUploadMetadata,
  type CropRect,
  type ProcessedImage,
} from "./processing";
import { assessQuality, readImageData, type QualityReport } from "./quality";
import { useKeepPhoto, usePhotoUpload } from "./use-photo-upload";
import { useRecognisePhoto } from "./use-recognition";
import { RecognitionStep } from "./confirm/recognition-step";
import { Button } from "@sbi/ui";

const CHECK_LABELS = {
  exposure: "Exposure",
  resolution: "Resolution",
  sharpness: "Sharpness",
  subject: "Object size",
};

const CROP_FIELDS = [
  { key: "x", label: "Left (px)" },
  { key: "y", label: "Top (px)" },
  { key: "width", label: "Width (px)" },
  { key: "height", label: "Height (px)" },
] as const;

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 8h3l2-3h6l2 3h3v11H4z M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 15V4 M7 9l5-5 5 5 M5 15v5h14v-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function describe(image: ProcessedImage): string {
  const format = image.type === "image/jpeg" || image.type === "" ? "JPEG" : image.type;
  return `${image.width} by ${image.height} pixels, ${format} (${formatBytes(image.size)})`;
}

function fullFrame(image: ProcessedImage): CropRect {
  return { height: image.height, width: image.width, x: 0, y: 0 };
}

export function CaptureForm() {
  const limits = webEnv.capture;
  const uploadId = useId();
  const problemId = useId();
  const checkId = useId();
  const confirmId = useId();
  const uploadHintId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const takeRef = useRef<HTMLButtonElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraNote, setCameraNote] = useState<{ text: string; offerApp: boolean } | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  // Bumped on every new selection so a slow earlier decode cannot overwrite a newer photo.
  const runRef = useRef(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [processingProblem, setProblem] = useState<string | null>(null);
  const [processing, setBusy] = useState(false);
  const [original, setOriginal] = useState<ProcessedImage | null>(null);
  const [prepared, setPrepared] = useState<ProcessedImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const photoUpload = usePhotoUpload();
  const keep = useKeepPhoto();
  const recognition = useRecognisePhoto();
  // One session per visit groups retakes; accounts will replace it (#102).
  const sessionRef = useRef<string | undefined>(undefined);
  const busy = processing || photoUpload.isPending || keep.isPending;
  const problem = processingProblem ?? photoUpload.error?.message ?? keep.error?.message ?? null;
  const stage = photoUpload.stage;
  const uploaded = photoUpload.isSuccess;
  const photoKey = photoUpload.data?.key ?? null;
  const kept = keep.isSuccess;

  // Guidance only: a failed check never blocks uploading.
  async function assess(image: ProcessedImage) {
    try {
      const bitmap = await createImageBitmap(image.blob);
      try {
        setQuality(assessQuality(readImageData(bitmap), {}, image));
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
    photoUpload.reset();
    keep.reset();
    recognition.reset();
  }

  function retake() {
    clear();
    for (const input of [cameraRef.current, uploadRef.current]) {
      if (input) {
        input.value = "";
      }
    }
    takeRef.current?.focus();
  }

  // A live view needs a secure page and browser support; otherwise the device's own camera app opens.
  function takePhoto() {
    if (typeof navigator.mediaDevices?.getUserMedia === "function") {
      setCameraNote(null);
      setCameraOpen(true);
    } else {
      setCameraNote({
        text: "This browser can't show a live camera here, so your camera app opens instead.",
        offerApp: false,
      });
      cameraRef.current?.click();
    }
  }

  function closeCamera() {
    setCameraOpen(false);
    takeRef.current?.focus();
  }

  async function choose(selected: File | undefined) {
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
      const image = await stripUploadMetadata(await normaliseImage(selected, limits));
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
        setProblem(
          error instanceof Error ? error.message : "We couldn't read that photo. Try another one.",
        );
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
      const image = await stripUploadMetadata(await cropImage(original.blob, crop, limits));
      if (run === runRef.current) {
        setPrepared(image);
        await assess(image);
      }
    } catch (error) {
      if (run === runRef.current) {
        setProblem(
          error instanceof Error
            ? error.message
            : "We couldn't crop that photo. Try again, or upload it without cropping.",
        );
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

  function upload() {
    if (!prepared) {
      return;
    }
    setProblem(null);
    keep.reset();
    recognition.reset();
    photoUpload.mutate(prepared, {
      onSuccess: (photo) =>
        recognition.mutate(
          { key: photo.key, sessionId: sessionRef.current },
          {
            onSuccess: (reply) => {
              sessionRef.current = reply.sessionId;
            },
          },
        ),
    });
  }

  function keepPhoto() {
    if (photoKey) {
      keep.mutate(photoKey);
    }
  }

  const status = problem
    ? null
    : stage
      ? stage
      : busy
        ? "Preparing your photo…"
        : kept
          ? "Kept. This photo will not be deleted automatically."
          : uploaded
            ? "Uploaded, with location and camera details removed. Your lesson can begin."
            : prepared
              ? `Ready: ${describe(prepared)}.`
              : fileName
                ? `Selected ${fileName}.`
                : null;

  return (
    <>
      <form
        aria-label="Photo capture"
        className="capture-path capture-form"
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          upload();
        }}
      >
        <fieldset className="photo-choice">
          <legend>Add a photo</legend>
          <div className="photo-choice__actions">
            <button
              ref={takeRef}
              type="button"
              className="sbi-button sbi-button--primary"
              aria-expanded={cameraOpen}
              onClick={takePhoto}
            >
              <CameraIcon />
              Take a photo
            </button>
            <span className="photo-choice__upload">
              <input
                id={uploadId}
                ref={uploadRef}
                name="upload"
                type="file"
                className="photo-choice__file"
                aria-invalid={problem ? true : undefined}
                aria-describedby={problem ? problemId : undefined}
                accept={ACCEPTED_EXTENSIONS}
                onChange={(event) => void choose(event.currentTarget.files?.[0])}
              />
              <label htmlFor={uploadId} className="sbi-button sbi-button--quiet">
                <UploadIcon />
                Upload a photo
              </label>
            </span>
          </div>
          {/* The fallback when no live view is possible: the device's own camera app. */}
          <input
            ref={cameraRef}
            name="camera"
            type="file"
            hidden
            accept="image/*"
            capture="environment"
            onChange={(event) => void choose(event.currentTarget.files?.[0])}
          />
          {cameraOpen ? (
            <CameraView
              onCancel={closeCamera}
              onSnap={(photo) => {
                closeCamera();
                void choose(photo);
              }}
              onUnavailable={(reason) => {
                setCameraOpen(false);
                setCameraNote({
                  text: `${reason} You can use your camera app or upload a photo instead.`,
                  offerApp: true,
                });
              }}
            />
          ) : null}
          {cameraNote ? (
            <div className="photo-choice__note">
              <p>{cameraNote.text}</p>
              {cameraNote.offerApp ? (
                <button
                  type="button"
                  className="sbi-button sbi-button--quiet sbi-button--small"
                  onClick={() => cameraRef.current?.click()}
                >
                  Open camera app
                </button>
              ) : null}
            </div>
          ) : null}
        </fieldset>
        <p className="sbi-field__hint">
          Accepted formats: {ACCEPTED_FORMATS_LABEL}. Maximum size:{" "}
          {uploadLimitLabel(limits.maxUploadBytes)}.
        </p>
        <div role="alert" id={problemId} className="capture-problem">
          {problem}
        </div>
        <div role="status" className="sbi-status">
          {status ? <p>{status}</p> : null}
        </div>
        {original && previewUrl && crop ? (
          <fieldset className="crop-panel">
            <legend>Crop (optional)</legend>
            <CropBox
              src={previewUrl}
              imageWidth={original.width}
              imageHeight={original.height}
              rect={crop}
              onChange={setCrop}
            />
            <div className="crop-fields">
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
            </div>
            <div className="crop-actions">
              <Button
                variant="quiet"
                type="button"
                onClick={() => setCrop(fullFrame(original))}
                disabled={busy}
              >
                Reset crop
              </Button>
              <Button
                variant="quiet"
                type="button"
                onClick={() => void applyCrop()}
                disabled={busy}
              >
                Apply crop
              </Button>
              <Button variant="quiet" type="button" onClick={retake}>
                Retake or choose another
              </Button>
            </div>
          </fieldset>
        ) : null}
        {/* Kept mounted so screen readers announce guidance when it appears. */}
        <div aria-live="polite">
          {prepared && !busy ? (
            <section aria-labelledby={checkId} className="photo-check">
              <h2 id={checkId}>Photo check</h2>
              {quality ? (
                <ul>
                  {quality.checks.map((check) => (
                    <li key={check.id} className={check.passed ? "check--pass" : "check--fix"}>
                      {check.passed
                        ? `${CHECK_LABELS[check.id]}: good`
                        : (check.guidance ?? "Retake the photo.")}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>We couldn&apos;t check this photo, but you can still upload it.</p>
              )}
            </section>
          ) : null}
        </div>
        {uploaded && photoKey && !kept ? (
          <Button variant="quiet" type="button" onClick={keepPhoto} disabled={busy}>
            Keep this photo
          </Button>
        ) : null}
        <Button
          type="submit"
          block
          disabled={!prepared || busy}
          aria-describedby={!prepared || busy ? uploadHintId : undefined}
        >
          Upload photo
        </Button>
        {!prepared || busy ? (
          <p id={uploadHintId} className="sbi-field__hint">
            {busy ? "Wait until your photo is ready." : "Take or choose a photo first."}
          </p>
        ) : null}
      </form>
      {uploaded ? (
        <section aria-labelledby={confirmId} className="capture-path">
          <h2 id={confirmId}>What is in your photo?</h2>
          <RecognitionStep recognition={recognition} />
        </section>
      ) : null}
    </>
  );
}
