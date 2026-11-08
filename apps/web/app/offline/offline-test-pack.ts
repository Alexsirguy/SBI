import { LessonPack, newId } from "@sbi/contracts";
import { SAMPLE_LESSON, SAMPLE_SOURCES } from "../lesson/sample-lesson";

const VISUAL_ID = newId();

/** A saved lesson whose one visual was held back for rights, so tests see the fallback. */
export const TEST_PACK: LessonPack = LessonPack.parse({
  exportedAt: "2026-11-08T12:00:00.000Z",
  format: "sbi-lesson-pack",
  lesson: {
    ...SAMPLE_LESSON,
    visuals: [
      {
        alt: "How light bends through the lens",
        kind: "process",
        manifestUri: `/visuals?visualId=${VISUAL_ID}`,
        visualId: VISUAL_ID,
      },
    ],
  },
  packVersion: 1,
  sources: SAMPLE_SOURCES,
  visuals: [],
  withheld: [
    {
      alt: "How light bends through the lens",
      kind: "process",
      reason: "rights",
      text: "Light bends as it enters the glass and again as it leaves.",
      visualId: VISUAL_ID,
    },
  ],
});
