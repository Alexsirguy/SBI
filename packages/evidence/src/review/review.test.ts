import { describe, expect, it } from "vitest";
import { outdatedSources } from "./outdated";
import { LessonReview, needsCorrection, RUBRIC_VERSION, summariseReviews } from "./rubric";
import { sampleForReview, type SampleCandidate } from "./sample";

const review = (findings: LessonReview["findings"] = []): LessonReview =>
  LessonReview.parse({
    rubricVersion: RUBRIC_VERSION,
    lessonId: "0192f1a0-0000-7000-8000-00000000a001",
    version: 1,
    reviewer: "physics reviewer A",
    reviewedAt: "2026-11-04T10:00:00Z",
    scores: { accuracy: 4, evidence: 3, uncertainty: 3, clarity: 4 },
    findings,
  });

describe("quality review (#80)", () => {
  it("flags any critical finding for correction, and nothing less", () => {
    expect(needsCorrection(review())).toBe(false);
    const minor = { category: "misleading-simplification", severity: "minor", note: "Rounded." };
    expect(needsCorrection(review([minor as never]))).toBe(false);
    const critical = { category: "factual-error", severity: "critical", note: "Wrong sign." };
    expect(needsCorrection(review([critical as never]))).toBe(true);
  });

  it("summarises errors per lesson by severity, and mean scores", () => {
    const summary = summariseReviews([
      review([{ category: "factual-error", severity: "critical", note: "x" }]),
      review([{ category: "outdated-source", severity: "major", note: "y" }]),
    ]);
    expect(summary).toMatchObject({
      lessons: 2,
      needingCorrection: 1,
      errorsPerLesson: { critical: 0.5, major: 0.5, minor: 0 },
      meanScores: { accuracy: 4, evidence: 3 },
      byCategory: { "factual-error": 1, "outdated-source": 1 },
    });
  });

  it("refuses a review against another rubric version", () => {
    expect(() => LessonReview.parse({ ...review(), rubricVersion: "quality-review-v0" })).toThrow();
  });

  it("samples every high-safety and the most reused lesson, then evenly across strata", () => {
    const candidates: SampleCandidate[] = [
      ...Array.from({ length: 20 }, (_, i) => ({
        lessonId: `object-${i}`,
        version: 1,
        taxonomyId: `object.thing-${i}`,
        safetyClass: "low" as const,
        reuseCount: i === 7 ? 50 : 0,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        lessonId: `subject-${i}`,
        version: 1,
        taxonomyId: `subject.idea-${i}`,
        safetyClass: "low" as const,
        reuseCount: 0,
      })),
      {
        lessonId: "risky",
        version: 2,
        taxonomyId: "object.bleach",
        safetyClass: "high",
        reuseCount: 0,
      },
    ];
    const sample = sampleForReview(candidates, { size: 8, seed: 42, mostReused: 1 });
    const ids = sample.map((item) => item.lessonId);
    expect(sample).toHaveLength(8);
    expect(ids).toContain("risky");
    expect(ids).toContain("object-7");
    // The small stratum gets its share instead of being swamped by the larger one.
    expect(ids.filter((id) => id.startsWith("subject-")).length).toBeGreaterThanOrEqual(3);
    expect(sampleForReview(candidates, { size: 8, seed: 42, mostReused: 1 })).toEqual(sample);
  });

  it("finds sources whose last check found them changed, and ones overdue a check", () => {
    const now = new Date("2026-11-04T00:00:00Z");
    const result = outdatedSources(
      [
        { sourceId: "a", freshness: { status: "current", checkedAt: "2026-11-01T00:00:00Z" } },
        { sourceId: "b", freshness: { status: "changed", checkedAt: "2026-11-01T00:00:00Z" } },
        { sourceId: "c" },
      ],
      now,
      30,
    );
    expect(result.outdated).toEqual(["b"]);
    expect(result.outdatedRate).toBeCloseTo(1 / 3);
    expect(result.unverifiedRate).toBeCloseTo(1 / 3);
  });
});
