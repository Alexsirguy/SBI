import { z } from "zod";
import { Id, IsoDateTime, Locale, SafetyClass, Uuid } from "./common";
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

/** One cited passage, quoted only where its licence allows; otherwise the reader links out. */
export const SourceExcerpt = z.object({
  excerptId: z.string().min(1),
  mode: z.enum(["quote", "link"]),
  text: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
});

/** A source as the learner sees it: title, link and the credit its licence asks for. */
export const LessonSource = z.object({
  sourceId: Uuid,
  title: z.string().min(1),
  url: z.url().optional(),
  credit: z.string().min(1),
  license: z.object({ label: z.string().min(1), url: z.url().optional() }).optional(),
  excerpts: z.array(SourceExcerpt).default([]),
});

/** Streamed after the lesson, so citation markers can name and link their sources. */
export const LessonSources = z.object({
  lessonId: Uuid,
  sources: z.array(LessonSource),
});

export const LessonVisuals = z.object({
  lessonId: Uuid,
  visuals: z.array(VisualRef),
});

export const FeedbackCategory = z.enum([
  "wrong-fact",
  "unclear",
  "unsafe",
  "missing-source",
  "offensive",
  "other",
]);

/** Feedback on one lesson version, so triage sees exactly what the learner read. */
export const LessonFeedbackRequest = z
  .object({
    lessonId: Uuid,
    version: z.int().positive(),
    report: z
      .object({
        category: FeedbackCategory,
        details: z.string().trim().min(1).max(1000).optional(),
      })
      .optional(),
    rating: z
      .object({
        helpful: z.int().min(1).max(5),
        clear: z.int().min(1).max(5),
      })
      .optional(),
  })
  .refine((feedback) => feedback.report !== undefined || feedback.rating !== undefined, {
    message: "Report a problem or rate the lesson.",
    path: ["report"],
  });

export const LessonFeedbackReceipt = z.object({
  feedbackId: Uuid,
  receivedAt: IsoDateTime,
});

export type LessonRequest = z.infer<typeof LessonRequest>;
export type FeedbackCategory = z.infer<typeof FeedbackCategory>;
export type LessonFeedbackRequest = z.infer<typeof LessonFeedbackRequest>;
export type LessonFeedbackReceipt = z.infer<typeof LessonFeedbackReceipt>;
export type LessonKind = z.infer<typeof LessonKind>;
export type QuickAnswer = z.infer<typeof QuickAnswer>;
export type LessonVisuals = z.infer<typeof LessonVisuals>;
export type SourceExcerpt = z.infer<typeof SourceExcerpt>;
export type LessonSource = z.infer<typeof LessonSource>;
export type LessonSources = z.infer<typeof LessonSources>;
export type LessonProgress = z.infer<typeof LessonProgress>;
