import { z } from "zod";
import { Id, IsoDateTime, Locale, SafetyClass, Uuid } from "./common";
import { AudienceBand, LessonDisclaimer, ReadingLevel, ReviewStatus } from "./lesson";
import { VisualRef } from "./visual";

// A lesson is about a catalogue object or any subject the learner names (ADR 0013).
export const LessonRequest = z
  .object({
    question: z.string().trim().min(3).max(500),
    taxonomyId: Id.optional(),
    subject: z.string().trim().min(2).max(80).optional(),
    /** A curriculum topic to teach; the lesson is written to its goals and level (#422). */
    topicCode: z
      .string()
      .regex(/^[A-Za-z0-9.-]{2,60}$/)
      .optional(),
    audience: AudienceBand,
    readingLevel: ReadingLevel,
    locale: Locale,
    // A floor only: the server's classifier can raise it, never lower it.
    safetyClass: SafetyClass,
    assumptions: z.array(z.string().trim().min(1).max(300)).default([]),
    fresh: z.boolean().default(false),
    /** Asked from a class link: the class's controls apply on the server (#113). */
    classCode: z.string().max(20).optional(),
  })
  .refine(
    (request) =>
      request.taxonomyId !== undefined ||
      request.subject !== undefined ||
      request.topicCode !== undefined,
    {
      message: "Name an object, a subject or a curriculum topic.",
      path: ["subject"],
    },
  );

/** Asks for questions a learner might have about the object they just named (#325). */
export const QuestionSuggestionRequest = z.object({
  subject: z.string().trim().min(2).max(80),
  audience: AudienceBand.default("general"),
  readingLevel: ReadingLevel.default("plain"),
  // Questions come back in this language (#107); older clients get English.
  locale: Locale.default("en"),
});

export const SUGGESTED_QUESTION_COUNT = 5;

export const QuestionSuggestions = z.object({
  questions: z.array(z.string().trim().min(3).max(200)).min(1).max(SUGGESTED_QUESTION_COUNT),
  /** "fixed" when the model was off or failed, so the same five stood in. */
  source: z.enum(["model", "fixed"]),
});
export type QuestionSuggestions = z.infer<typeof QuestionSuggestions>;

/** Questions that fit any object, for when no model can suggest better ones. */
/** "de el" contracts to "del" in Spanish. */
export function deEs(name: string): string {
  return name.startsWith("el ") ? `del ${name.slice(3)}` : `de ${name}`;
}

export function fixedQuestions(subject: string, locale?: string): string[] {
  // Worded so they read right for any object, one or many, made or living.
  if (locale && /^es(-|$)/i.test(locale)) {
    // Spanish articles carry gender we cannot guess, so the learner's own wording is kept.
    const nombre = subject.trim().toLowerCase();
    return [
      `¿Cuál es la ciencia detrás ${deEs(nombre)}?`,
      `¿De qué materiales está hecho ${nombre}, y por qué?`,
      `¿Qué fuerzas o qué energía actúan sobre ${nombre}?`,
      `¿Qué cambiaría si ${nombre} fuera más grande o más pequeño?`,
      `¿Qué suele entender mal la gente sobre ${nombre}?`,
    ];
  }
  const name = subject
    .trim()
    .toLowerCase()
    .replace(/^(a|an|the)\s+/, "");
  return [
    `What is the science behind the ${name}?`,
    `What materials are in the ${name}, and why?`,
    `Which forces or energy act on the ${name}?`,
    `What would change if the ${name} were bigger or smaller?`,
    `What do people often get wrong about the ${name}?`,
  ];
}

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

/** GETs take query strings, so the version arrives as digits. */
export const RelatedLessonsRequest = z.object({
  lessonId: Uuid,
  version: z.string().regex(/^[1-9]\d{0,5}$/),
});

/** Next things to learn, chosen from the concept graph, never from what others clicked (#106). */
export const RelatedLessons = z.object({
  related: z.array(
    z.object({
      taxonomyId: Id,
      label: z.string(),
      via: z.string(),
      distance: z.union([z.literal(1), z.literal(2)]),
    }),
  ),
});

/** Which suggestion a learner followed; no learner id, so it measures the list, not people. */
export const NextConceptEventRequest = z.object({
  fromLessonId: Uuid,
  toTaxonomyId: Id,
  rank: z.number().int().min(0).max(20),
});

export const RecordedEvent = z.object({ ok: z.literal(true) });
