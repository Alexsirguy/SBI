import type { LessonFeedbackRequest } from "@sbi/contracts";
import type { LessonFeedbackRepository } from "@sbi/db";
import { afterEach, describe, expect, it } from "vitest";
import { createRateLimiter } from "../common/rate-limiter";
import { startTestApp, type TestApp } from "../testing/test-app";
import { LessonFeedbackController } from "./feedback.controller";

const LESSON_ID = "0192f1a0-0000-7000-8000-00000000a001";

function memoryFeedback() {
  const stored: LessonFeedbackRequest[] = [];
  const repository: LessonFeedbackRepository = {
    async record(feedback, at) {
      stored.push(feedback);
      return {
        ...feedback,
        feedbackId: "0192f1a0-0000-7000-8000-00000000f001",
        receivedAt: at.toISOString(),
      };
    },
    async forLesson() {
      return [];
    },
    async clearDetailsBefore() {
      return 0;
    },
  };
  return { stored, repository };
}

const lessons = (known: { lessonId: string; version: number }[]) => ({
  get: async (lessonId: string, version: number) =>
    known.some((item) => item.lessonId === lessonId && item.version === version)
      ? ({} as never)
      : undefined,
});

describe("LessonFeedbackController", () => {
  it("stores feedback on a lesson version learners were shown and returns a receipt", async () => {
    const feedback = memoryFeedback();
    const controller = new LessonFeedbackController(
      feedback.repository,
      lessons([{ lessonId: LESSON_ID, version: 2 }]),
      createRateLimiter({ limit: 5, windowMs: 60_000 }),
    );
    const body = {
      lessonId: LESSON_ID,
      version: 2,
      report: { category: "unclear" as const, details: "Step two lost me." },
      rating: { helpful: 3, clear: 2 },
    };
    const receipt = await controller.submit(body, "203.0.113.7");
    expect(receipt.feedbackId).toMatch(/^[0-9a-f-]{36}$/);
    expect(feedback.stored).toEqual([body]);
  });

  it("refuses feedback for a lesson version that does not exist", async () => {
    const feedback = memoryFeedback();
    const controller = new LessonFeedbackController(
      feedback.repository,
      lessons([]),
      createRateLimiter({ limit: 5, windowMs: 60_000 }),
    );
    await expect(
      controller.submit(
        { lessonId: LESSON_ID, version: 9, rating: { helpful: 5, clear: 5 } },
        "203.0.113.7",
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(feedback.stored).toEqual([]);
  });
});

describe("LessonFeedbackController throttling", () => {
  it("answers 429 once one client sends too much, and keeps others unaffected", async () => {
    const feedback = memoryFeedback();
    const controller = new LessonFeedbackController(
      feedback.repository,
      lessons([{ lessonId: LESSON_ID, version: 1 }]),
      createRateLimiter({ limit: 2, windowMs: 60_000 }),
    );
    const rate = { lessonId: LESSON_ID, version: 1, rating: { helpful: 5, clear: 5 } };
    await controller.submit(rate, "203.0.113.7");
    await controller.submit(rate, "203.0.113.7");
    await expect(controller.submit(rate, "203.0.113.7")).rejects.toMatchObject({ status: 429 });
    await expect(controller.submit(rate, "198.51.100.2")).resolves.toBeDefined();
    expect(feedback.stored).toHaveLength(3);
  });
});

describe("lesson feedback route", () => {
  let test: TestApp | undefined;

  afterEach(async () => {
    await test?.app.close();
  });

  it("answers 400 with a plain message for empty or malformed feedback", async () => {
    test = await startTestApp();
    const response = await test.post("/lessons/feedback", { lessonId: LESSON_ID, version: 1 });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Choose a problem to report or rate the lesson.",
    });
  });
});
