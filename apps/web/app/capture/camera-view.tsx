"use client";

import { Button } from "@sbi/ui";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useT } from "../i18n/provider";
import { englishCapture, type CaptureT } from "./messages";

type Facing = "environment" | "user";

/** Turns a refused or missing camera into words a learner can act on. */
export function cameraProblem(error: unknown, t: CaptureT = englishCapture): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return t("cameraNotAllowed");
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return t("cameraNotFound");
  }
  return t("cameraFailed");
}

/** A live in-page camera; frames stay on the device and only a snapped photo is passed on. */
export function CameraView({
  onSnap,
  onCancel,
  onUnavailable,
}: {
  onSnap: (photo: File) => void;
  onCancel: () => void;
  onUnavailable: (problem: string) => void;
}) {
  const t = useT("capture");
  const videoRef = useRef<HTMLVideoElement>(null);
  const snapRef = useRef<HTMLButtonElement>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [ready, setReady] = useState(false);
  const [canSwitch, setCanSwitch] = useState(false);
  const unavailable = useEffectEvent((error: unknown) => onUnavailable(cameraProblem(error, t)));
  const cancel = useEffectEvent(onCancel);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    navigator.mediaDevices
      .getUserMedia({ audio: false, video: { facingMode: { ideal: facing } } })
      .then(async (opened) => {
        if (stopped) {
          opened.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = opened;
        if (videoRef.current) {
          videoRef.current.srcObject = opened;
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCanSwitch(devices.filter((device) => device.kind === "videoinput").length > 1);
      })
      .catch((error: unknown) => {
        if (!stopped) unavailable(error);
      });
    return () => {
      stopped = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [facing]);

  useEffect(() => {
    snapRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onSnap(new File([blob], "camera-photo.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <section aria-label={t("cameraLabel")} className="camera-view">
      <video
        ref={videoRef}
        className="camera-view__feed"
        aria-label={t("liveViewLabel")}
        autoPlay
        muted
        playsInline
        onPlaying={() => setReady(true)}
      />
      <p role="status" className="sbi-status">
        {ready ? t("cameraReady") : t("cameraStarting")}
      </p>
      <p className="sbi-field__hint">{t("cameraPrivacyHint")}</p>
      <div className="camera-view__actions">
        <Button ref={snapRef} type="button" onClick={snap}>
          {t("snap")}
        </Button>
        {canSwitch ? (
          <Button
            variant="quiet"
            type="button"
            onClick={() => {
              setReady(false);
              setFacing((current) => (current === "environment" ? "user" : "environment"));
            }}
          >
            {t("switchCamera")}
          </Button>
        ) : null}
        <Button variant="quiet" type="button" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </section>
  );
}
