import { z } from "zod";
import { IsoDateTime, Uuid } from "./common";
import { Lesson } from "./lesson";
import { LessonSources } from "./lesson-api";
import { ServedVisual, VisualKind } from "./visual";

export const PACK_FORMAT = "sbi-lesson-pack";
export const PACK_VERSION = 1;

/** Why a visual isn't in a pack; the lesson shows its text description instead. */
export const WithheldReason = z.enum(["rights", "needs-connection", "unavailable"]);

/** A lesson that opens with no connection: its visuals and their credits travel with it (#116). */
export const LessonPack = z.object({
  format: z.literal(PACK_FORMAT),
  packVersion: z.literal(PACK_VERSION),
  exportedAt: IsoDateTime,
  lesson: Lesson,
  sources: LessonSources,
  visuals: z.array(ServedVisual),
  withheld: z.array(
    z.object({
      visualId: Uuid,
      kind: VisualKind,
      alt: z.string().min(1),
      text: z.string().min(1),
      reason: WithheldReason,
    }),
  ),
});
export type LessonPack = z.infer<typeof LessonPack>;

export const LessonPackRequest = z.object({
  lessonId: Uuid,
  version: z.number().int().positive(),
});
