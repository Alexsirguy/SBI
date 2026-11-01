import { describe, expect, it } from "vitest";
import type { Lesson } from "@sbi/contracts";
import { LlmError } from "@sbi/llm";
import type { CheckReport } from "./checks";
import type { TaxonomyLessonLookup } from "./lesson-repository";
import { runWithFallback, type FallbackQuery, type GenerationAttempt } from "./pipeline";
import { LESSON_DRAFT_PROMPT_VERSION } from "./draft";
import { makeLesson } from "./lesson-fixture";

const fallbackQuery: FallbackQuery = {
  taxonomyIds: ["home.kettle", "category.heating"],
  locale: "en-GB",
  safetyClass: "low",
  audience: "general",
  policyVersion: "safety-1",
  promptVersion: LESSON_DRAFT_PROMPT_VERSION,
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

const SHARED = { ...makeLesson().reuse, cacheScope: "shared" as const };

function gated(version = 1, overrides: Record<string, unknown> = {}): Lesson {
  return makeLesson({ reviewStatus: "auto-validated", version, reuse: SHARED, ...overrides });
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
      detail: "stub: timed out after 20ms",
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
      detail: "stub: invalid structured output (oops)",
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
      gated(3, { locale: "fr" }),
      gated(4, { audience: ["child"] }),
      gated(5, { reuse: { ...SHARED, policyVersion: "safety-0" } }),
      gated(6, { safetyClass: "medium" }),
      gated(7, { reuse: { ...SHARED, cacheScope: "private" } }),
      gated(8, { reuse: { ...SHARED, promptVersion: "lesson-draft@6" } }),
    ];
    const attempt: GenerationAttempt = async () => {
      throw new LlmError("stub: empty completion");
    };

    const outcome = await runWithFallback(memoryLookup(stored), attempt, fallbackQuery);

    expect(outcome.kind).toBe("fallback");
    if (outcome.kind === "fallback") expect(outcome.lesson.version).toBe(2);
  });

  it("falls back to a category lesson when the entry has none of its own", async () => {
    const categoryLesson = gated(1, { taxonomyId: "category.heating" });
    const attempt: GenerationAttempt = async () => {
      throw new LlmError("stub: timed out after 10ms");
    };
    const outcome = await runWithFallback(memoryLookup([categoryLesson]), attempt, fallbackQuery);
    expect(outcome.kind).toBe("fallback");
    if (outcome.kind === "fallback") expect(outcome.lesson.taxonomyId).toBe("category.heating");
  });

  it("prefers the entry's own lesson over its category's", async () => {
    const stored = [gated(1, { taxonomyId: "category.heating" }), gated(1)];
    const attempt: GenerationAttempt = async () => {
      throw new LlmError("stub: timed out after 10ms");
    };
    const outcome = await runWithFallback(memoryLookup(stored), attempt, fallbackQuery);
    if (outcome.kind === "fallback") expect(outcome.lesson.taxonomyId).toBe("home.kettle");
  });

  it("serves a disclosed lesson as fresh only when it carries disclaimers", async () => {
    const disclosed = makeLesson({
      reviewStatus: "needs-review",
      disclaimers: [{ kind: "awaiting-review", message: "Not reviewed yet.", sectionIds: [] }],
    });
    const served = await runWithFallback(
      memoryLookup(),
      async () => ({
        lesson: disclosed,
        report: report(false, ["entailment"]),
        disclosed: true,
      }),
      fallbackQuery,
    );
    expect(served.kind).toBe("fresh");

    const bare = await runWithFallback(
      memoryLookup(),
      async () => ({
        lesson: makeLesson({ reviewStatus: "needs-review" }),
        report: report(false, ["entailment"]),
        disclosed: true,
      }),
      fallbackQuery,
    );
    expect(bare.kind).toBe("retry");
  });
});
