"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useT } from "../i18n/provider";
import { clampCrop, moveCrop, type CropRect } from "./processing";

type Corner = "nw" | "ne" | "sw" | "se";

interface DragState {
  corner: Corner | null;
  startX: number;
  startY: number;
  start: CropRect;
  // Photo pixels per screen pixel, measured when the drag starts so any frame width works.
  scale: number;
}

const ARROWS: Record<string, [number, number]> = {
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
};

const CORNERS: Corner[] = ["nw", "ne", "sw", "se"];

// The smallest crop a learner can make, so the object is never squeezed to nothing.
const MIN_SHARE = 0.1;

/** Resizes from one corner, keeping the opposite corner where it was. */
export function resizeFromCorner(
  start: CropRect,
  corner: Corner,
  dx: number,
  dy: number,
  imageWidth: number,
  imageHeight: number,
): CropRect {
  const minW = Math.max(1, imageWidth * MIN_SHARE);
  const minH = Math.max(1, imageHeight * MIN_SHARE);
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  if (corner.includes("w")) left = Math.min(Math.max(0, left + dx), right - minW);
  if (corner.includes("e")) right = Math.max(Math.min(imageWidth, right + dx), left + minW);
  if (corner.includes("n")) top = Math.min(Math.max(0, top + dy), bottom - minH);
  if (corner.includes("s")) bottom = Math.max(Math.min(imageHeight, bottom + dy), top + minH);
  return clampCrop(
    { x: left, y: top, width: right - left, height: bottom - top },
    imageWidth,
    imageHeight,
  );
}

/** The crop step drawn over the photo: drag to move, corners to resize, or arrow keys. */
export function CropOverlay({
  src,
  imageWidth,
  imageHeight,
  rect,
  onChange,
}: {
  src: string;
  imageWidth: number;
  imageHeight: number;
  rect: CropRect;
  onChange: (rect: CropRect) => void;
}) {
  const t = useT("capture");
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  // A fiftieth of the photo per key press keeps keyboard cropping usable at any resolution.
  const step = Math.max(1, Math.round(Math.max(imageWidth, imageHeight) / 50));
  const percent = (value: number, of: number) => `${(value / of) * 100}%`;

  function apply(state: Pick<DragState, "corner" | "start">, dx: number, dy: number) {
    onChange(
      state.corner
        ? resizeFromCorner(state.start, state.corner, dx, dy, imageWidth, imageHeight)
        : moveCrop(state.start, dx, dy, imageWidth, imageHeight),
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const arrow = ARROWS[event.key];
    if (!arrow) return;
    event.preventDefault();
    apply({ corner: event.shiftKey ? "se" : null, start: rect }, arrow[0] * step, arrow[1] * step);
  }

  function startDrag(event: PointerEvent<HTMLElement>, corner: Corner | null) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const width = frameRef.current?.getBoundingClientRect().width || imageWidth;
    drag.current = {
      corner,
      start: rect,
      startX: event.clientX,
      startY: event.clientY,
      scale: imageWidth / width,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const state = drag.current;
    if (!state) return;
    apply(
      state,
      (event.clientX - state.startX) * state.scale,
      (event.clientY - state.startY) * state.scale,
    );
  }

  const endDrag = () => {
    drag.current = null;
  };
  const whole = rect.width === imageWidth && rect.height === imageHeight;

  return (
    <div ref={frameRef} className="crop-overlay">
      {/* A local object URL of the learner's photo, which next/image cannot optimise. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={t("yourPhoto")} draggable={false} />
      <button
        type="button"
        className="crop-overlay__area"
        aria-label={
          whole
            ? t("cropAreaWhole")
            : t("cropAreaPart", {
                width: Math.round((rect.width / imageWidth) * 100),
                height: Math.round((rect.height / imageHeight) * 100),
              })
        }
        onKeyDown={onKeyDown}
        onPointerDown={(event) => startDrag(event, null)}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          left: percent(rect.x, imageWidth),
          top: percent(rect.y, imageHeight),
          width: percent(rect.width, imageWidth),
          height: percent(rect.height, imageHeight),
        }}
      >
        {CORNERS.map((corner) => (
          <span
            key={corner}
            aria-hidden="true"
            className={`crop-overlay__handle crop-overlay__handle--${corner}`}
            onPointerDown={(event) => startDrag(event, corner)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        ))}
      </button>
    </div>
  );
}
