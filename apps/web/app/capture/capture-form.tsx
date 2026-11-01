"use client";

import { Button } from "@sbi/ui";
import { useEffect, useId, useRef, useState } from "react";
import { webEnv } from "../../env";
import { handedOffPhoto, handOffPhoto } from "../photo-handoff";
import { Scanner } from "../scanner";
import { CameraView } from "./camera-view";
import { RecognitionStep } from "./confirm/recognition-step";
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_FORMATS_LABEL,
  uploadLimitLabel,
  validateSelection,
} from "./limits";
import { CropOverlay } from "./crop-overlay";
import {
  cropImage,
  normaliseImage,
  stripUploadMetadata,
  type CropRect,
  type ProcessedImage,
} from "./processing";
import { assessQuality, readImageData, type QualityCheck } from "./quality";
import { suggestCrop } from "./suggest-crop";
import { usePhotoUpload } from "./use-photo-upload";
import { useRecognisePhoto } from "./use-recognition";

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

// The prototype's flow: choose a photo, see only what would stop it working, then upload and pick.
export function CaptureForm() {
  const limits = webEnv.capture;
  const uploadId = useId();
  const problemId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const takeRef = useRef<HTMLButtonElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraNote, setCameraNote] = useState<{ text: string; offerApp: boolean } | null>(null);
  // Bumped on every new selection so a slow earlier decode cannot overwrite a newer photo.
  const runRef = useRef(0);
  const [processingProblem, setProblem] = useState<string | null>(null);
  const [processing, setBusy] = useState(false);
  const [original, setOriginal] = useState<ProcessedImage | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [cropping, setCropping] = useState(false);
  const [prepared, setPrepared] = useState<ProcessedImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [issues, setIssues] = useState<QualityCheck[]>([]);
  const photoUpload = usePhotoUpload();
  const recognition = useRecognisePhoto();
  // One session per visit groups retakes; accounts will replace it (#102).
  const sessionRef = useRef<string | undefined>(undefined);
  const problem = processingProblem ?? photoUpload.error?.message ?? null;
  const looking = photoUpload.isPending || recognition.isPending;
  const answered = recognition.isSuccess || recognition.isError;
  const step = answered
    ? "choices"
    : looking
      ? "looking"
      : cropping
        ? "cropping"
        : previewUrl
          ? "selected"
          : "choose";

  // One step at a time, as in the prototype: each new step starts at the top of the screen.
  useEffect(() => {
    if (step !== "choose") formRef.current?.scrollIntoView({ block: "start" });
  }, [step]);

  // Only failed checks matter to the learner; they guide, and never block uploading.
  async function assess(image: ProcessedImage) {
    try {
      const bitmap = await createImageBitmap(image.blob);
      try {
        const report = assessQuality(readImageData(bitmap), {}, image);
        setIssues(report.checks.filter((check) => !check.passed));
      } finally {
        bitmap.close();
      }
    } catch {
      setIssues([]);
    }
  }

  useEffect(() => {
    return () => {
      // The lesson page's loader may still be showing a photo handed on to it.
      if (previewUrl && previewUrl !== handedOffPhoto()) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
    };
  }, [originalUrl]);

  // Frames what stands out from the photo's edges; any failure leaves the whole photo.
  async function suggest(image: ProcessedImage): Promise<CropRect> {
    const whole = { x: 0, y: 0, width: image.width, height: image.height };
    try {
      const bitmap = await createImageBitmap(image.blob);
      try {
        return suggestCrop(readImageData(bitmap), image.width, image.height);
      } finally {
        bitmap.close();
      }
    } catch {
      return whole;
    }
  }

  function clear() {
    runRef.current += 1;
    setProblem(null);
    setBusy(false);
    setOriginal(null);
    setOriginalUrl(null);
    setCrop(null);
    setCropping(false);
    setPrepared(null);
    setPreviewUrl(null);
    setIssues([]);
    photoUpload.reset();
    recognition.reset();
  }

  function retake() {
    clear();
    for (const input of [cameraRef.current, uploadRef.current]) {
      if (input) input.value = "";
    }
    // The choice buttons render again on the next frame, so focus waits for them.
    requestAnimationFrame(() => takeRef.current?.focus());
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
    if (!selected) return;
    clear();
    const run = runRef.current;
    const issue = validateSelection(selected, limits.maxUploadBytes);
    if (issue) {
      setProblem(issue);
      return;
    }
    setBusy(true);
    try {
      const image = await stripUploadMetadata(await normaliseImage(selected, limits));
      if (run !== runRef.current) return;
      const suggested = await suggest(image);
      if (run !== runRef.current) return;
      setOriginal(image);
      setOriginalUrl(URL.createObjectURL(image.blob));
      setCrop(suggested);
      setCropping(true);
    } catch (error) {
      if (run === runRef.current) {
        setProblem(
          error instanceof Error ? error.message : "We couldn't read that photo. Try another one.",
        );
      }
    } finally {
      if (run === runRef.current) setBusy(false);
    }
  }

  // Cropping happens on the device, from the normalised original, so metadata stays stripped.
  async function finishCrop() {
    if (!original || !crop) return;
    const run = runRef.current;
    setBusy(true);
    setProblem(null);
    try {
      const whole = crop.width === original.width && crop.height === original.height;
      const image = whole
        ? original
        : await stripUploadMetadata(await cropImage(original.blob, crop, limits));
      if (run !== runRef.current) return;
      await assess(image);
      setPrepared(image);
      setPreviewUrl(URL.createObjectURL(image.blob));
      setCropping(false);
    } catch (error) {
      if (run === runRef.current) {
        setProblem(
          error instanceof Error
            ? error.message
            : "We couldn't crop that photo. Try again, or use the whole photo.",
        );
      }
    } finally {
      if (run === runRef.current) setBusy(false);
    }
  }

  function upload() {
    if (!prepared) return;
    setProblem(null);
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

  const status = problem
    ? null
    : looking
      ? (photoUpload.stage ?? "Looking closely…")
      : processing
        ? "Preparing your photo…"
        : cropping
          ? "We framed what looks like the object. Adjust it if you need to, then press Done."
          : prepared && !answered
            ? issues.length > 0
              ? "Photo ready to upload, though it may be hard to recognise."
              : "Photo ready to upload."
            : null;

  return (
    <>
      <form
        ref={formRef}
        aria-label="Photo capture"
        className="capture-path capture-form"
        aria-busy={processing || looking}
        onSubmit={(event) => {
          event.preventDefault();
          upload();
        }}
      >
        {answered && previewUrl ? (
          <div className="photo-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Your photo" />
          </div>
        ) : looking ? (
          <div className="looking">
            <h2>Looking closely…</h2>
            <Scanner src={previewUrl} />
            <p className="sbi-field__hint">Checking shapes, parts and materials.</p>
          </div>
        ) : cropping && original && originalUrl && crop ? (
          <div className="cropping">
            <h2>Crop your photo</h2>
            <CropOverlay
              src={originalUrl}
              imageWidth={original.width}
              imageHeight={original.height}
              rect={crop}
              onChange={setCrop}
            />
            <div className="selected__actions">
              <Button type="button" onClick={() => void finishCrop()} disabled={processing}>
                Done
              </Button>
              {/* Offered only when it would change something; on a whole-photo crop it cannot. */}
              {crop.width < original.width || crop.height < original.height ? (
                <Button
                  variant="quiet"
                  type="button"
                  onClick={() =>
                    setCrop({ x: 0, y: 0, width: original.width, height: original.height })
                  }
                >
                  Use the whole photo
                </Button>
              ) : null}
              <Button variant="quiet" type="button" onClick={retake}>
                Choose another photo
              </Button>
            </div>
          </div>
        ) : prepared && previewUrl ? (
          <div className="selected">
            <div className="photo-frame">
              {/* Learners never see the numbers; tests read them to check normalisation. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Your photo"
                data-width={prepared.width}
                data-height={prepared.height}
                data-type={prepared.type || "image/jpeg"}
                data-bytes={prepared.size}
              />
            </div>
            {issues.length > 0 ? (
              <div className="photo-issues">
                <p>
                  <strong>This photo may be hard to recognise.</strong> Try another, or upload it
                  anyway.
                </p>
                <ul>
                  {issues.map((check) => (
                    <li key={check.id}>{check.guidance ?? "Retake the photo."}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="selected__actions">
              <Button type="submit">Upload photo</Button>
              <Button variant="quiet" type="button" onClick={() => setCropping(true)}>
                Crop again
              </Button>
              <Button variant="quiet" type="button" onClick={retake}>
                Choose another photo
              </Button>
            </div>
          </div>
        ) : (
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
            {cameraOpen ? (
              <CameraView
                onCancel={closeCamera}
                onSnap={(photo) => {
                  setCameraOpen(false);
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
            <p className="sbi-field__hint">
              Accepted formats: {ACCEPTED_FORMATS_LABEL}. Maximum size:{" "}
              {uploadLimitLabel(limits.maxUploadBytes)}.
            </p>
          </fieldset>
        )}
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
        {/* Kept mounted, so problems and progress are announced as they change. */}
        <div role="alert" id={problemId} className="capture-problem">
          {problem}
        </div>
        {/* While loading, the heading says it on screen; the status still announces it. */}
        <div role="status" className={looking ? "sbi-visually-hidden" : "sbi-status"}>
          {status ? <p>{status}</p> : null}
        </div>
      </form>
      {answered && previewUrl ? (
        <RecognitionStep
          reply={recognition.data}
          error={recognition.error?.message}
          onStart={(label) => handOffPhoto(previewUrl, label)}
          onRetake={retake}
        />
      ) : null}
    </>
  );
}
