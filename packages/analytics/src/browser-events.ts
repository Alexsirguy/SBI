import { z } from "zod";

/** Mixpanel's EU-residency endpoint, the only place usage statistics are sent (ADR 0026). */
export const MIXPANEL_EU_HOST = "https://api-eu.mixpanel.com";

// Ids and slugs only: anything longer or with spaces could be a learner's own words.
const Id = z.string().regex(/^[A-Za-z0-9._:-]{1,80}$/);
const Version = z.number().int().min(0);

export const ElapsedBucket = z.enum(["<1s", "1-3s", "3-10s", "10-30s", "30-60s", ">60s"]);
export const SizeBucket = z.enum(["<250KB", "250KB-1MB", "1-3MB", "3-10MB", ">10MB"]);
export const ConfidenceBand = z.enum(["high", "medium", "low", "none"]);
export const Certainty = z.enum(["likely", "possible", "unsure", "none"]);

/** Added to every event by the tracker; never a learner, account, IP or URL (ADR 0026). */
export const EventContext = z.strictObject({
  consentVersion: z.string().regex(/^consent-\d+$/),
  route: z.enum(["home", "capture", "lesson", "pathway", "privacy", "account", "other"]),
  locale: z.enum(["en", "es"]),
  // Never "child": under-13s send nothing at all.
  ageBand: z.enum(["teen", "adult", "general"]),
  deviceTier: z.enum(["low", "mid", "high"]),
});
export type EventContext = z.infer<typeof EventContext>;

const lesson = { lessonId: Id, version: Version };

/** The spec §13 events and the only properties each may carry. */
export const BROWSER_EVENTS = {
  capture_started: z.strictObject({ source: z.enum(["camera", "upload", "describe"]) }),
  photo_submitted: z.strictObject({
    source: z.enum(["camera", "upload"]),
    fileClass: z.enum(["jpeg", "png", "webp", "heic", "other"]),
    sizeBucket: SizeBucket,
  }),
  // Options are the model's own words, so only their count and certainty are sent.
  recognition_shown: z.strictObject({
    optionCount: z.number().int().min(0).max(3),
    topCertainty: Certainty,
    elapsed: ElapsedBucket,
  }),
  recognition_confirmed: z.strictObject({
    rank: z.number().int().min(0).max(2),
    certainty: Certainty,
  }),
  recognition_corrected: z.strictObject({ correctionClass: z.enum(["described", "retake"]) }),
  // A quick answer arrives before the lesson exists, so it has no lesson id yet.
  lesson_first_content: z.strictObject({
    lessonId: Id.optional(),
    version: Version.optional(),
    kind: z.enum(["quick-answer", "lesson"]),
    elapsed: ElapsedBucket,
  }),
  section_opened: z.strictObject({ ...lesson, sectionId: Id }),
  visual_loaded: z.strictObject({
    visualId: Id,
    kind: Id,
    elapsed: ElapsedBucket,
  }),
  interaction_changed: z.strictObject({
    visualId: Id,
    controlId: Id,
    rangeBucket: z.enum(["low", "mid", "high"]),
  }),
  tutor_question: z.strictObject({
    ...lesson,
    replyKind: z.enum(["lesson", "beyond-lesson", "clarifying", "policy", "fallback"]),
    citedCount: z.number().int().min(0).max(20),
    safetyCategory: Id.optional(),
  }),
  answer_feedback: z.strictObject({ ...lesson, helpful: z.boolean() }),
  concept_check_answered: z.strictObject({
    ...lesson,
    // A catalogue id, or "subject" for typed subjects, whose ids are made from the learner's words.
    topic: Id,
    itemId: Id,
    instrument: Id,
    phase: z.enum(["pre", "post"]),
    correct: z.boolean(),
    explanationOpened: z.boolean(),
  }),
  lesson_rated: z.strictObject({
    ...lesson,
    topic: Id.optional(),
    helpful: z.number().int().min(1).max(5).optional(),
    clear: z.number().int().min(1).max(5).optional(),
  }),
  issue_reported: z.strictObject({ ...lesson, category: Id }),
  lesson_saved: z.strictObject({ ...lesson, action: z.enum(["saved", "removed"]) }),
  timing_measured: z.strictObject({
    metric: z.enum(["time_to_label", "first_readable_lesson", "interactive_ready"]),
    // Raw milliseconds, so Mixpanel can give real p50/p95; capped at ten minutes.
    ms: z.number().int().min(0).max(600_000),
  }),
} as const;

export type BrowserEventName = keyof typeof BROWSER_EVENTS;
export type BrowserEventProps<N extends BrowserEventName> = z.input<(typeof BROWSER_EVENTS)[N]>;
