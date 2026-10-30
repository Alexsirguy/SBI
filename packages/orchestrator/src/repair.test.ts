import type { Completion, CompletionRequest, LlmProvider } from "@sbi/llm";
import { describe, expect, it } from "vitest";
import type { CheckReport } from "./checks";
import { makeLesson } from "./lesson-fixture";
import { repairable, REVISE_PROMPT_VERSION, reviseSections } from "./repair";

function provider(text: string, seen: CompletionRequest[] = []): LlmProvider {
  return {
    id: "stub",
    model: "stub-1",
    async complete(request): Promise<Completion> {
      seen.push(request);
      return {
        text: JSON.stringify({ text }),
        model: "stub-1",
        latencyMs: 1,
        usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
        prompt: request.prompt,
      };
    },
  };
}

const report = (results: CheckReport["results"]): CheckReport => ({
  lessonId: "l",
  version: 1,
  passed: false,
  results,
  checkedAt: "2026-10-29T09:00:00Z",
});

const entailmentFailure = {
  name: "entailment",
  passed: false,
  details: ['Section "first-principles-3" is insufficient: adds uncited detail'],
  sections: [{ sectionId: "first-principles-3", reason: "insufficient: adds uncited detail" }],
};

describe("repairable", () => {
  it("is true only when entailment findings are the sole failure", () => {
    expect(repairable(report([entailmentFailure]))).toBe(true);
    expect(
      repairable(report([entailmentFailure, { name: "evidence", passed: false, details: ["x"] }])),
    ).toBe(false);
    expect(repairable(report([{ ...entailmentFailure, sections: [] }]))).toBe(false);
  });
});

describe("reviseSections", () => {
  it("rewrites only the rejected sections, keeps their citations and refreshes the hash", async () => {
    const lesson = makeLesson();
    const seen: CompletionRequest[] = [];
    const revised = await reviseSections(lesson, report([entailmentFailure]), {
      provider: provider("Metals expand when heated [123e4567-e89b-12d3-a456-426614174001].", seen),
      objectLabel: "Electric kettle",
    });
    const before = lesson.sections.find((section) => section.sectionId === "first-principles-3");
    const after = revised.sections.find((section) => section.sectionId === "first-principles-3");
    expect(after?.text).toBe("Metals expand when heated.");
    expect(after?.claimIds).toEqual(before?.claimIds);
    expect(
      revised.sections.filter((section) => section.sectionId !== "first-principles-3"),
    ).toEqual(lesson.sections.filter((section) => section.sectionId !== "first-principles-3"));
    expect(revised.reuse.contentHash).not.toBe(lesson.reuse.contentHash);
    expect(seen[0]?.prompt).toEqual({ id: "lesson-revise", version: REVISE_PROMPT_VERSION });
    expect(String(seen[0]?.messages[1]?.content)).toContain("adds uncited detail");
  });
});
