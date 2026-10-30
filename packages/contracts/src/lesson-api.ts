import { z } from "zod";
import { Id, Locale, SafetyClass, Uuid } from "./common";
import { AudienceBand, LessonDisclaimer, ReadingLevel, ReviewStatus } from "./lesson";
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
  // Absent when the answer streams before the lesson that will carry it exists.
  title: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  shortAnswer: z.string().min(1),
  /** The stored claims the answer rests on. */
  claimIds: z.array(Uuid).default([]),
  reviewStatus: ReviewStatus,
  /** Shown with the answer itself, so a risky topic never appears without its safety notice. */
  disclaimers: z.array(LessonDisclaimer).optional(),
  /** Why a fallback stands in; absent for fresh and cached lessons. */
  note: z.string().min(1).optional(),
});

export const LessonStage = z.enum(["planning", "researching", "verified", "drafting", "checking"]);

/** Streamed while evidence is gathered, so a slow first request is not a silent wait. */
export const LessonProgress = z.object({
  stage: LessonStage,
  message: z.string().min(1).max(300),
  /** Verified claims so far, when the stage has produced any. */
  claims: z.int().nonnegative().optional(),
});

export const LessonVisuals = z.object({
  lessonId: Uuid,
  visuals: z.array(VisualRef),
});

export type LessonRequest = z.infer<typeof LessonRequest>;
export type LessonKind = z.infer<typeof LessonKind>;
export type QuickAnswer = z.infer<typeof QuickAnswer>;
export type LessonVisuals = z.infer<typeof LessonVisuals>;
export type LessonProgress = z.infer<typeof LessonProgress>;
