import type { LessonVisuals } from "@sbi/contracts";

// A stage diagram may sit beside the experiment, but it has no sliders to drive.
export function experimentVisualId(visuals: LessonVisuals["visuals"] | undefined) {
  return visuals?.find((visual) => visual.kind !== "process")?.visualId;
}
