import { describe, expect, it } from "vitest";
import type { Lesson } from "@sbi/contracts";
import { LlmError } from "@sbi/llm";
import type { CheckReport } from "./checks";
import type { TaxonomyLessonLookup } from "./lesson-repository";
import { runWithFallback, type FallbackQuery, type GenerationAttempt } from "./pipeline";
import { makeLesson } from "./lesson-fixture";

const fallbackQuery: FallbackQuery = {
  taxonomyId: "home.kettle",
  locale: "en-GB",
  audience: "general",
  policyVersion: "safety-1",
};

function memoryLookup(stored: Lesson[] = []): TaxonomyLessonLookup {
  return {
    async findByTaxonomy(taxonomyId) {
      return stored.filter((lesson) => lesson.taxonomyId === taxonomyId);
    },
  };
}

function report(passed: boolean, failedNames: string[] = []): CheckReport {
  return {
    lessonId: "lesson",
    version: 1,
    passed,
    results: failedNames.map((name) => ({ name, passed: false, details: ["broken"] })),
    checkedAt: new Date().toISOString(),
  };
}

function gated(version = 1): Lesson {
  return makeLesson({ reviewStatus: "auto-validated", version });
}

describe("runWithFallback", () => {
  it("returns the fresh lesson when checks pass", async () => {
    const lesson = makeLesson();
    const attempt: GenerationAttempt = async () => ({ lesson, report: report(true) });

    const outcome = await runWithFallback(memoryLookup(), attempt, fallbackQuery);

    expect(outcome.kind).toBe("fresh");
    if (outcome.kind === "fresh") {
      expect(outcome.lesson).toBe(lesson);
      expect(outcome.report.passed).toBe(true);
    }
  });

  it("serves a category fallback on provider timeout", async () => {
    const attempt: GenerationAttempt = async () => {
      throw new LlmError("stub: timed out after 20ms");
    };

    const outcome = await runWithFallback(memoryLookup([gated()]), attempt, fallbackQuery);

    expect(outcome.kind).toBe("fallback");
    if (outcome.kind === "fallback") {
      expect(outcome.lesson.version).toBe(1);
      expect(outcome.reason).toContain("timed out");
      expect(outcome.reason).toContain("cached lesson");
    }
  });

  it("asks for a retry when timeouts leave no fallback", async () => {
    const attempt: GenerationAttempt = async () => {
      throw new LlmError("stub: timed out after 20ms");
    };

    const outcome = await runWithFallback(memoryLookup(), attempt, fallbackQuery);

    expect(outcome).toEqual({
      kind: "retry",
      reason: "The language model timed out; try again",
    });
  });

  it("falls back or retries when checks fail", async () => {
    const attempt: GenerationAttempt = async () => ({
      lesson: makeLesson(),
      report: report(false, ["entailment"]),
    });

    const served = await runWithFallback(memoryLookup([gated()]), attempt, fallbackQuery);
    expect(served.kind).toBe("fallback");
    if (served.kind === "fallback") expect(served.reason).toContain("entailment");

    const retry = await runWithFallback(memoryLookup(), attempt, fallbackQuery);
    expect(retry).toEqual({
      kind: "retry",
      reason: "Automated checks failed: entailment; try again",
    });
  });

  it("names invalid model output in the retry", async () => {
    const attempt: GenerationAttempt = async () => {
      throw new LlmError("stub: invalid structured output (oops)");
    };

    const outcome = await runWithFallback(memoryLookup(), attempt, fallbackQuery);

    expect(outcome).toEqual({
      kind: "retry",
      reason: "The draft failed validation; try again",
    });
  });

  it("lets programmer errors through instead of masking them", async () => {
    const attempt: GenerationAttempt = async () => {
      throw new TypeError("not a lesson");
    };

    await expect(runWithFallback(memoryLookup([gated()]), attempt, fallbackQuery)).rejects.toThrow(
      "not a lesson",
    );
  });

  it("only falls back to gated, aligned lessons, newest first", async () => {
    const stored = [
      makeLesson(),
      gated(1),
      gated(2),
      makeLesson({ reviewStatus: "auto-validated", locale: "fr" }),
      makeLesson({ reviewStatus: "auto-validated", audience: ["child"] }),
      makeLesson({
        reviewStatus: "auto-validated",
        reuse: { ...makeLesson().reuse, policyVersion: "safety-0" },
      }),
    ];
    const attempt: GenerationAttempt = async () => {
      throw new LlmError("stub: empty completion");
    };

    const outcome = await runWithFallback(memoryLookup(stored), attempt, fallbackQuery);

    expect(outcome.kind).toBe("fallback");
    if (outcome.kind === "fallback") expect(outcome.lesson.version).toBe(2);
  });
});
