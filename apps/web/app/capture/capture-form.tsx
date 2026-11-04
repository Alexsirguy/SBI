"use client";

import { Button } from "@sbi/ui";
import { useEffect, useId, useRef, useState } from "react";
import { webEnv } from "../../env";
import { useT } from "../i18n/provider";
import { handedOffPhoto, handOffPhoto } from "../photo-handoff";
import { Scanner } from "../scanner";
import { CameraView } from "./camera-view";
import { RecognitionStep } from "./confirm/recognition-step";
import { KeepPhoto } from "./keep-photo";
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_FORMATS_LABEL,
  uploadLimitLabel,
  validateSelection,
} from "./limits";
import { CropOverlay } from "./crop-overlay";
import { blurFaces, type BlurResult } from "./face-blur";
import { CaptureError, type CaptureKey, type CaptureT } from "./messages";
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
import { elapsedBucket, sizeBucket } from "@sbi/analytics";
import { markFunnelStart } from "../analytics/clock";
import { track } from "../analytics/track";
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
/** Says when faces were hidden, or when the check could not run, so the learner can decide. */
function FaceNote({ check }: { check: Pick<BlurResult, "faces" | "checked"> | null }) {
  const t = useT("capture");
  if (!check || (check.checked && check.faces === 0)) return null;
  const { faces } = check;
  return (
    <p className="face-note">
      {check.checked
        ? faces === 1
          ? t("facesBlurredOne")
          : t("facesBlurredOther", { count: faces })
        : t("facesUnchecked")}
    </p>
  );
}

// A failure we raised ourselves is shown in the learner's language; anything else as it came.
function fileClass(type: string): "jpeg" | "png" | "webp" | "heic" | "other" {
  const sub = type.split("/")[1];
  if (sub === "jpeg" || sub === "png" || sub === "webp") return sub;
  return sub === "heic" || sub === "heif" ? "heic" : "other";
}

function problemText(error: unknown, t: CaptureT, fallback: CaptureKey) {
  if (error instanceof CaptureError) return t(error.key);
  return error instanceof Error ? error.message : t(fallback);
}

export function CaptureForm() {
  const t = useT("capture");
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
  const [faceCheck, setFaceCheck] = useState<Pick<BlurResult, "faces" | "checked"> | null>(null);
  const photoUpload = usePhotoUpload();
  const recognition = useRecognisePhoto();
  // One session per visit groups retakes; accounts will replace it (#102).
  const sessionRef = useRef<string | undefined>(undefined);
  const sourceRef = useRef<"camera" | "upload">("upload");
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
        const report = assessQuality(readImageData(bitmap), {}, image, t);
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
    setFaceCheck(null);
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
    markFunnelStart();
    track("capture_started", { source: "camera" });
    if (typeof navigator.mediaDevices?.getUserMedia === "function") {
      setCameraNote(null);
      setCameraOpen(true);
    } else {
      setCameraNote({ text: t("liveCameraUnsupported"), offerApp: false });
      cameraRef.current?.click();
    }
  }

  function closeCamera() {
    setCameraOpen(false);
    takeRef.current?.focus();
  }

  async function choose(selected: File | undefined, source: "camera" | "upload") {
    if (!selected) return;
    sourceRef.current = source;
    // The camera started the clock when it opened; a picked file starts it here.
    if (source === "upload") {
      markFunnelStart();
      track("capture_started", { source });
    }
    clear();
    const run = runRef.current;
    const issue = validateSelection(selected, limits.maxUploadBytes, t);
    if (issue) {
      setProblem(issue);
      return;
    }
    setBusy(true);
    try {
      // Faces are hidden before the crop, so every copy that is shown or sent is already blurred.
      const blurred = await blurFaces(await normaliseImage(selected, limits));
      const image = await stripUploadMetadata(blurred.image);
      if (run !== runRef.current) return;
      setFaceCheck({ faces: blurred.faces, checked: blurred.checked });
      const suggested = await suggest(image);
      if (run !== runRef.current) return;
      setOriginal(image);
      setOriginalUrl(URL.createObjectURL(image.blob));
      setCrop(suggested);
      setCropping(true);
    } catch (error) {
      if (run === runRef.current) {
        setProblem(problemText(error, t, "readFailed"));
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
        setProblem(problemText(error, t, "cropFailed"));
      }
    } finally {
      if (run === runRef.current) setBusy(false);
    }
  }

  function upload() {
    if (!prepared) return;
    setProblem(null);
    recognition.reset();
    const sent = performance.now();
    track("photo_submitted", {
      source: sourceRef.current,
      fileClass: fileClass(prepared.blob.type),
      sizeBucket: sizeBucket(prepared.size),
    });
    photoUpload.mutate(prepared, {
      onSuccess: (photo) =>
        recognition.mutate(
          { key: photo.key, sessionId: sessionRef.current },
          {
            onSuccess: (reply) => {
              sessionRef.current = reply.sessionId;
              track("recognition_shown", {
                optionCount: reply.options.length,
                topCertainty: reply.options[0]?.certainty ?? "none",
                elapsed: elapsedBucket(performance.now() - sent),
              });
            },
          },
        ),
    });
  }

  const status = problem
    ? null
    : looking
      ? (photoUpload.stage ?? t("lookingClosely"))
      : processing
        ? t("preparing")
        : cropping
          ? t("cropStatus")
          : prepared && !answered
            ? issues.length > 0
              ? t("readyWithIssues")
              : t("ready")
            : null;

  return (
    <>
      <form
        ref={formRef}
        aria-label={t("formLabel")}
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
            <img src={previewUrl} alt={t("yourPhoto")} />
          </div>
        ) : looking ? (
          <div className="looking">
            <h2>{t("lookingClosely")}</h2>
            <Scanner src={previewUrl} />
            <p className="sbi-field__hint">{t("lookingHint")}</p>
          </div>
        ) : cropping && original && originalUrl && crop ? (
          <div className="cropping">
            <h2>{t("cropHeading")}</h2>
            <FaceNote check={faceCheck} />
            <CropOverlay
              src={originalUrl}
              imageWidth={original.width}
              imageHeight={original.height}
              rect={crop}
              onChange={setCrop}
            />
            <div className="selected__actions">
              <Button type="button" onClick={() => void finishCrop()} disabled={processing}>
                {t("done")}
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
                  {t("useWholePhoto")}
                </Button>
              ) : null}
              <Button variant="quiet" type="button" onClick={retake}>
                {t("chooseAnother")}
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
                alt={t("yourPhoto")}
                data-width={prepared.width}
                data-height={prepared.height}
                data-type={prepared.type || "image/jpeg"}
                data-bytes={prepared.size}
              />
            </div>
            {issues.length > 0 ? (
              <div className="photo-issues">
                <p>
                  <strong>{t("issuesLead")}</strong> {t("issuesAdvice")}
                </p>
                <ul>
                  {issues.map((check) => (
                    <li key={check.id}>{check.guidance ?? t("retakeFallback")}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="selected__actions">
              <Button type="submit">{t("uploadPhoto")}</Button>
              <Button variant="quiet" type="button" onClick={() => setCropping(true)}>
                {t("cropAgain")}
              </Button>
              <Button variant="quiet" type="button" onClick={retake}>
                {t("chooseAnother")}
              </Button>
            </div>
          </div>
        ) : (
          <fieldset className="photo-choice">
            <legend>{t("addPhoto")}</legend>
            <div className="photo-choice__actions">
              <button
                ref={takeRef}
                type="button"
                className="sbi-button sbi-button--primary"
                aria-expanded={cameraOpen}
                onClick={takePhoto}
              >
                <CameraIcon />
                {t("takePhoto")}
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
                  onChange={(event) => void choose(event.currentTarget.files?.[0], "upload")}
                />
                <label htmlFor={uploadId} className="sbi-button sbi-button--quiet">
                  <UploadIcon />
                  {t("uploadAPhoto")}
                </label>
              </span>
            </div>
            {cameraOpen ? (
              <CameraView
                onCancel={closeCamera}
                onSnap={(photo) => {
                  setCameraOpen(false);
                  void choose(photo, "camera");
                }}
                onUnavailable={(reason) => {
                  setCameraOpen(false);
                  setCameraNote({
                    text: t("cameraUnavailableNote", { reason }),
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
                    {t("openCameraApp")}
                  </button>
                ) : null}
              </div>
            ) : null}
            <p className="sbi-field__hint">
              {t("formatsHint", {
                formats: ACCEPTED_FORMATS_LABEL,
                size: uploadLimitLabel(limits.maxUploadBytes),
              })}
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
          onChange={(event) => void choose(event.currentTarget.files?.[0], "camera")}
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
          onRetake={() => {
            track("recognition_corrected", { correctionClass: "retake" });
            retake();
          }}
        />
      ) : null}
      {answered && photoUpload.data && recognition.isSuccess ? (
        <KeepPhoto
          photoKey={photoUpload.data.key}
          label={recognition.data.options[0]?.label ?? t("photoFallbackLabel")}
        />
      ) : null}
    </>
  );
}
