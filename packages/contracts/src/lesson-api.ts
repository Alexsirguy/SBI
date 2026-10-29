import { z } from "zod";
import { Id, Locale, SafetyClass, Uuid } from "./common";
import { AudienceBand, ReadingLevel, ReviewStatus } from "./lesson";
import { VisualRef } from "./visual";

export const LessonRequest = z.object({
  question: z.string().trim().min(3).max(500),
  taxonomyId: Id,
  audience: AudienceBand,
  readingLevel: ReadingLevel,
  locale: Locale,
  // Client-declared until E8 lands server-side classification; routing still reviews high-risk topics.
  safetyClass: SafetyClass,
  assumptions: z.array(z.string().trim().min(1).max(300)).default([]),
  fresh: z.boolean().default(false),
});

export const LessonKind = z.enum(["fresh", "cached", "fallback"]);

export const QuickAnswer = z.object({
  kind: LessonKind,
  lessonId: Uuid,
  version: z.int().positive(),
  title: z.string().min(1),
  summary: z.string().min(1),
  shortAnswer: z.string().min(1),
  reviewStatus: ReviewStatus,
  /** Why a fallback stands in; absent for fresh and cached lessons. */
  note: z.string().min(1).optional(),
});

export const LessonVisuals = z.object({
  lessonId: Uuid,
  visuals: z.array(VisualRef),
});

export type LessonRequest = z.infer<typeof LessonRequest>;
export type LessonKind = z.infer<typeof LessonKind>;
export type QuickAnswer = z.infer<typeof QuickAnswer>;
export type LessonVisuals = z.infer<typeof LessonVisuals>;
