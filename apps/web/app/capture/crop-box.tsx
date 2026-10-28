"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { clampCrop, moveCrop, type CropRect } from "./processing";

export const PREVIEW_WIDTH = 320;

interface CropBoxProps {
  src: string;
  imageWidth: number;
  imageHeight: number;
  rect: CropRect;
  onChange: (rect: CropRect) => void;
}

interface DragState {
  mode: "move" | "resize";
  startX: number;
  startY: number;
  start: CropRect;
}

const ARROWS: Record<string, [number, number]> = {
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
};

export function CropBox({ src, imageWidth, imageHeight, rect, onChange }: CropBoxProps) {
  const drag = useRef<DragState | null>(null);
  const scale = PREVIEW_WIDTH / imageWidth;
  // A fiftieth of the image per key press keeps keyboard cropping usable at any resolution.
  const step = Math.max(1, Math.round(Math.max(imageWidth, imageHeight) / 50));

  function shift(mode: DragState["mode"], start: CropRect, dx: number, dy: number) {
    onChange(
      mode === "move"
        ? moveCrop(start, dx, dy, imageWidth, imageHeight)
        : clampCrop(
            { ...start, height: start.height + dy, width: start.width + dx },
            imageWidth,
            imageHeight,
          ),
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const arrow = ARROWS[event.key];
    if (!arrow) {
      return;
    }
    event.preventDefault();
    shift(event.shiftKey ? "resize" : "move", rect, arrow[0] * step, arrow[1] * step);
  }

  function startDrag(event: PointerEvent<HTMLElement>, mode: DragState["mode"]) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { mode, start: rect, startX: event.clientX, startY: event.clientY };
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const state = drag.current;
    if (state) {
      shift(
        state.mode,
        state.start,
        (event.clientX - state.startX) / scale,
        (event.clientY - state.startY) / scale,
      );
    }
  }

  function endDrag() {
    drag.current = null;
  }

  return (
    <div
      className="crop-box"
      style={{
        overflow: "hidden",
        position: "relative",
        touchAction: "none",
        width: PREVIEW_WIDTH,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt="Preview of the photo to upload"
        src={src}
        width={PREVIEW_WIDTH}
        style={{ display: "block" }}
      />
      <button
        type="button"
        aria-label={`Crop area, ${rect.width} by ${rect.height} pixels from ${rect.x}, ${rect.y}. Arrow keys move it; Shift and arrow keys resize it.`}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => startDrag(event, "move")}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          background: "transparent",
          border: "2px dashed #ffffff",
          boxShadow: "0 0 0 9999px rgb(0 0 0 / 45%)",
          cursor: "move",
          height: rect.height * scale,
          left: rect.x * scale,
          padding: 0,
          position: "absolute",
          top: rect.y * scale,
          width: rect.width * scale,
        }}
      >
        <span
          aria-hidden="true"
          onPointerDown={(event) => startDrag(event, "resize")}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{
            background: "#ffffff",
            bottom: -6,
            cursor: "nwse-resize",
            height: 12,
            position: "absolute",
            right: -6,
            width: 12,
          }}
        />
      </button>
    </div>
  );
}
