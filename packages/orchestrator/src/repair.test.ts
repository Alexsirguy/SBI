import type { Completion, CompletionRequest, LlmProvider } from "@sbi/llm";
import { describe, expect, it } from "vitest";
import type { CheckReport } from "./checks";
import { makeLesson } from "./lesson-fixture";
import { repairable, REVISE_PROMPT_VERSION, reviseSections, sectionsToRevise } from "./repair";

function provider(text: string, seen: CompletionRequest[] = [], heading?: string): LlmProvider {
  return {
    id: "stub",
    model: "stub-1",
    async complete(request): Promise<Completion> {
      seen.push(request);
      return {
        text: JSON.stringify({ heading, text }),
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
  details: ['Section "demonstrate-3" is insufficient: adds uncited detail'],
  sections: [{ sectionId: "demonstrate-3", reason: "insufficient: adds uncited detail" }],
};

const activityFailure = {
  name: "safe-activities",
  passed: false,
  details: ["integrate-5: Asks the learner to open a mains device"],
  sections: [{ sectionId: "integrate-5", reason: "Asks the learner to open a mains device" }],
};

describe("repairable", () => {
  it("is true when unsafe activities, alone or with entailment, are the only failures", () => {
    expect(repairable(report([activityFailure]))).toBe(true);
    expect(repairable(report([entailmentFailure, activityFailure]))).toBe(true);
    expect(
      repairable(report([activityFailure, { name: "schema", passed: false, details: ["x"] }])),
    ).toBe(false);
  });

  it("gathers every reason per section, for one rewrite each", () => {
    const both = {
      ...activityFailure,
      sections: [{ sectionId: "demonstrate-3", reason: "unsafe" }],
    };
    expect(sectionsToRevise(report([entailmentFailure, both, activityFailure]))).toEqual([
      { sectionId: "demonstrate-3", reason: "insufficient: adds uncited detail unsafe" },
      { sectionId: "integrate-5", reason: "Asks the learner to open a mains device" },
    ]);
  });

  it("is true only when entailment findings are the sole failure", () => {
    expect(repairable(report([entailmentFailure]))).toBe(true);
    expect(
      repairable(report([entailmentFailure, { name: "evidence", passed: false, details: ["x"] }])),
    ).toBe(false);
    expect(repairable(report([{ ...entailmentFailure, sections: [] }]))).toBe(false);
  });
});

describe("reviseSections", () => {
  it("rewrites an unsafe activity into something safe to notice", async () => {
    const lesson = makeLesson();
    const seen: CompletionRequest[] = [];
    const revised = await reviseSections(lesson, report([activityFailure]), {
      provider: provider("Listen for the click when your kettle switches off.", seen),
      objectLabel: "Electric kettle",
    });
    const after = revised.sections.find((section) => section.sectionId === "integrate-5");
    expect(after?.text).toBe("Listen for the click when your kettle switches off.");
    expect(String(seen[0]?.messages[0]?.content)).toContain("unsafe activity");
    expect(String(seen[0]?.messages[1]?.content)).toContain("open a mains device");
  });

  it("rewrites only the rejected sections, keeps their citations and refreshes the hash", async () => {
    const lesson = makeLesson();
    const seen: CompletionRequest[] = [];
    const revised = await reviseSections(lesson, report([entailmentFailure]), {
      provider: provider("Metals expand when heated [123e4567-e89b-12d3-a456-426614174001].", seen),
      objectLabel: "Electric kettle",
    });
    const before = lesson.sections.find((section) => section.sectionId === "demonstrate-3");
    const after = revised.sections.find((section) => section.sectionId === "demonstrate-3");
    expect(after?.text).toBe("Metals expand when heated.");
    expect(after?.claimIds).toEqual(before?.claimIds);
    expect(after?.steps).toEqual(before?.steps);
    expect(after?.steps).toHaveLength(2);
    expect(revised.sections.filter((section) => section.sectionId !== "demonstrate-3")).toEqual(
      lesson.sections.filter((section) => section.sectionId !== "demonstrate-3"),
    );
    expect(revised.reuse.contentHash).not.toBe(lesson.reuse.contentHash);
    expect(seen[0]?.prompt).toEqual({ id: "lesson-revise", version: REVISE_PROMPT_VERSION });
    expect(String(seen[0]?.messages[1]?.content)).toContain("adds uncited detail");
  });

  it("rewrites apply's challenge feedback and leaves its scene alone", async () => {
    const lesson = makeLesson();
    const apply = lesson.tasks.filter((task) => task.module === "apply");
    const seen: CompletionRequest[] = [];
    const challenges = apply.map((task) => ({
      feedback: task.options.map((_, at) => `Only what the claims say, ${at + 1}.`),
    }));
    const stub: LlmProvider = {
      ...provider("unused", seen),
      async complete(request) {
        seen.push(request);
        return {
          text: JSON.stringify({ challenges }),
          model: "stub-1",
          latencyMs: 1,
          usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
          prompt: request.prompt,
        };
      },
    };
    const finding = { sectionId: "apply-4", reason: "insufficient: a feedback adds detail" };
    const revised = await reviseSections(
      lesson,
      report([{ ...entailmentFailure, sections: [finding] }]),
      { provider: stub },
    );
    expect(seen.map((request) => request.prompt?.id)).toEqual(["lesson-revise-challenges"]);
    expect(String(seen[0]?.messages[1]?.content)).toContain(apply[0]?.prompt);
    expect(revised.sections).toEqual(lesson.sections);
    const after = revised.tasks.filter((task) => task.module === "apply");
    expect(after.map((task) => task.feedback)).toEqual(challenges.map((item) => item.feedback));
    expect(revised.tasks.find((task) => task.module === "activate")).toEqual(
      lesson.tasks.find((task) => task.module === "activate"),
    );
  });

  it("keeps the old feedback when a challenge revision drops one", async () => {
    const lesson = makeLesson();
    const stub: LlmProvider = {
      ...provider("unused"),
      async complete(request) {
        return {
          text: JSON.stringify({ challenges: [{ feedback: ["Only one."] }] }),
          model: "stub-1",
          latencyMs: 1,
          usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
          prompt: request.prompt,
        };
      },
    };
    const finding = { sectionId: "apply-4", reason: "insufficient" };
    const revised = await reviseSections(
      lesson,
      report([{ ...entailmentFailure, sections: [finding] }]),
      { provider: stub },
    );
    expect(revised.tasks).toEqual(lesson.tasks);
  });

  it("replaces a heading the reviser corrects, and keeps one it leaves out", async () => {
    const base = makeLesson();
    const lesson = {
      ...base,
      sections: base.sections.map((section) =>
        section.sectionId === "demonstrate-3"
          ? { ...section, heading: "Steam pressure lifts the lid" }
          : section,
      ),
    };
    const fixed = await reviseSections(lesson, report([entailmentFailure]), {
      provider: provider("Metals expand when heated.", [], "Warm metal expands"),
    });
    const kept = await reviseSections(lesson, report([entailmentFailure]), {
      provider: provider("Metals expand when heated."),
    });
    const heading = (target: typeof lesson) =>
      target.sections.find((section) => section.sectionId === "demonstrate-3")?.heading;
    expect(heading(fixed)).toBe("Warm metal expands");
    expect(heading(kept)).toBe("Steam pressure lifts the lid");
  });
});
