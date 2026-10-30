"use client";

import { Button } from "@sbi/ui";
import { useEffect, useEffectEvent, useRef, useState } from "react";

type Facing = "environment" | "user";

/** Turns a refused or missing camera into words a learner can act on. */
export function cameraProblem(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access was not allowed, so we can't show a live view here.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "We couldn't find a camera on this device.";
  }
  return "We couldn't start the camera here.";
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const snapRef = useRef<HTMLButtonElement>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [ready, setReady] = useState(false);
  const [canSwitch, setCanSwitch] = useState(false);
  const unavailable = useEffectEvent(onUnavailable);
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
        if (!stopped) unavailable(cameraProblem(error));
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
    <section aria-label="Camera" className="camera-view">
      <video
        ref={videoRef}
        className="camera-view__feed"
        aria-label="Live camera view"
        autoPlay
        muted
        playsInline
        onPlaying={() => setReady(true)}
      />
      <p role="status" className="sbi-status">
        {ready ? "Camera ready. Frame the object, then snap." : "Starting the camera…"}
      </p>
      <p className="sbi-field__hint">
        The live view stays on your device. Only the photo you snap is uploaded, and only when you
        choose Upload photo.
      </p>
      <div className="camera-view__actions">
        <Button ref={snapRef} type="button" onClick={snap}>
          Snap
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
            Switch camera
          </Button>
        ) : null}
        <Button variant="quiet" type="button" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
