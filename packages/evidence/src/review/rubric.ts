import { z } from "zod";

/** Bumped whenever a criterion, scale or category changes, so reviews stay comparable. */
export const RUBRIC_VERSION = "quality-review-v1";

/** How bad an error is for a learner (spec §13 "error severity"); definitions in the rubric doc. */
export const ErrorSeverity = z.enum(["critical", "major", "minor"]);
export type ErrorSeverity = z.infer<typeof ErrorSeverity>;

export const FindingCategory = z.enum([
  "factual-error",
  "unsupported-claim",
  "citation-mismatch",
  "outdated-source",
  "overstated-certainty",
  "misleading-simplification",
  "unsafe-suggestion",
]);

export const ReviewFinding = z.object({
  category: FindingCategory,
  severity: ErrorSeverity,
  /** Where it is, so the correction pathway can find it. */
  claimId: z.string().min(1).optional(),
  sectionId: z.string().min(1).optional(),
  note: z.string().trim().min(1).max(1000),
});

// 1 = wrong or missing, 4 = an expert would teach it this way.
const Score = z.int().min(1).max(4);

/** One expert's review of one lesson version against rubric v1. */
export const LessonReview = z.object({
  rubricVersion: z.literal(RUBRIC_VERSION),
  lessonId: z.uuid(),
  version: z.int().positive(),
  /** A role or initials, never a learner; reviews are staff records. */
  reviewer: z.string().trim().min(1).max(80),
  reviewedAt: z.iso.datetime({ offset: true }),
  scores: z.object({
    accuracy: Score,
    evidence: Score,
    uncertainty: Score,
    clarity: Score,
  }),
  findings: z.array(ReviewFinding).default([]),
});
export type LessonReview = z.infer<typeof LessonReview>;

/** A lesson with a critical finding must be corrected or withdrawn before anyone else reads it. */
export function needsCorrection(review: LessonReview): boolean {
  return review.findings.some((finding) => finding.severity === "critical");
}

/** What a batch of reviews says: errors per lesson by severity, and mean scores. */
export function summariseReviews(reviews: LessonReview[]) {
  const per = (severity: ErrorSeverity) =>
    reviews.length === 0
      ? 0
      : reviews.reduce(
          (sum, review) => sum + review.findings.filter((f) => f.severity === severity).length,
          0,
        ) / reviews.length;
  const mean = (key: keyof LessonReview["scores"]) =>
    reviews.length === 0 ? 0 : reviews.reduce((sum, r) => sum + r.scores[key], 0) / reviews.length;
  const byCategory: Record<string, number> = {};
  for (const finding of reviews.flatMap((review) => review.findings)) {
    byCategory[finding.category] = (byCategory[finding.category] ?? 0) + 1;
  }
  return {
    lessons: reviews.length,
    needingCorrection: reviews.filter(needsCorrection).length,
    errorsPerLesson: { critical: per("critical"), major: per("major"), minor: per("minor") },
    meanScores: {
      accuracy: mean("accuracy"),
      evidence: mean("evidence"),
      uncertainty: mean("uncertainty"),
      clarity: mean("clarity"),
    },
    byCategory,
  };
}
