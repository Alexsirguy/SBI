import { describe, expect, it } from "vitest";
import { LessonFeedbackRequest } from "./lesson-api";

const LESSON = { lessonId: "0192f1a0-0000-7000-8000-00000000a001", version: 2 };

describe("LessonFeedbackRequest", () => {
  it("accepts a report, a rating, or both, tied to one lesson version", () => {
    expect(
      LessonFeedbackRequest.safeParse({ ...LESSON, report: { category: "wrong-fact" } }).success,
    ).toBe(true);
    expect(
      LessonFeedbackRequest.safeParse({ ...LESSON, rating: { helpful: 4, clear: 5 } }).success,
    ).toBe(true);
    expect(
      LessonFeedbackRequest.parse({
        ...LESSON,
        report: { category: "unclear", details: "  The second step lost me.  " },
        rating: { helpful: 2, clear: 1 },
      }).report?.details,
    ).toBe("The second step lost me.");
  });

  it("refuses empty feedback, unknown categories and out-of-range ratings", () => {
    expect(LessonFeedbackRequest.safeParse(LESSON).success).toBe(false);
    expect(
      LessonFeedbackRequest.safeParse({ ...LESSON, report: { category: "spam" } }).success,
    ).toBe(false);
    expect(
      LessonFeedbackRequest.safeParse({ ...LESSON, rating: { helpful: 6, clear: 3 } }).success,
    ).toBe(false);
    expect(
      LessonFeedbackRequest.safeParse({
        ...LESSON,
        report: { category: "other", details: "x".repeat(1001) },
      }).success,
    ).toBe(false);
  });
});
