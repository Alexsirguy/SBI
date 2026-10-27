import type { CompletionRequest, LlmProvider } from "@sbi/llm";
import { describe, expect, it } from "vitest";
import { PROVIDERS } from "./providers";
import { rubricCsv, summarise, summaryMarkdown } from "./report";
import { promptsFor, runBenchmark } from "./run";
import { loadSeedSet } from "./seed-set";
import { judgeGuesses } from "./tasks/guess-judge";
import { placeGuess, scoreLesson, stepsToSections, type LessonDraft } from "./tasks/lesson";
import { LessonModule } from "@sbi/contracts";

const set = loadSeedSet();

const draft: LessonDraft = {
  title: "How it works",
  summary: "A short summary.",
  learningObjectives: ["Explain the idea"],
  misconceptionNotes: [],
  concepts: [{ conceptId: "energy", label: "Energy" }],
  steps: [
    "what-youre-seeing",
    "short-answer",
    "first-principles",
    "first-principles",
    "how-parts-work",
    "how-parts-work",
    "try-an-idea",
    "check-thinking",
    "history",
    "go-further",
  ].map((module, index) => ({
    module: module as LessonModule,
    title: index === 5 ? "Put it together" : `${module} step`,
    text: `${module} text`,
    guess: [3, 4, 7].includes(index)
      ? { question: "What follows?", options: ["This", "That"], answer: 1, why: "Because." }
      : null,
    claimIds: ["c1"],
  })),
  claims: [
    {
      claimId: "c1",
      text: "Energy is conserved.",
      status: "supported",
      confidence: "high",
      sourceIds: ["s1"],
      uncertainty: null,
    },
  ],
  sources: [{ sourceId: "s1", title: "Energy", url: "https://en.wikipedia.org/wiki/Energy" }],
};

// Answers each task by recognising which response schema the request asks for.
function fakeLlm(): LlmProvider {
  return {
    id: "fake",
    model: "fake-1",
    async complete(request: CompletionRequest) {
      const name = request.jsonSchema?.name;
      const text =
        name === "RecognitionOutput"
          ? {
              status: "recognised",
              candidates: [
                { label: "bicycle", certainty: "likely", calibratedConfidence: 0.9, reasons: [] },
              ],
              observations: [],
            }
          : name === "LessonDraft"
            ? {
                ...draft,
                steps: draft.steps.map((step) => ({
                  ...step,
                  guess: step.guess && {
                    question: step.guess.question,
                    why: step.guess.why,
                    correct: step.guess.options[step.guess.answer],
                    wrong: step.guess.options.filter((_, index) => index !== step.guess?.answer),
                  },
                })),
              }
            : { decision: "allow", category: "none", learnerMessage: "Let's learn!" };
      return {
        text: JSON.stringify(text),
        model: "fake-1",
        latencyMs: 100,
        usage: { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 500 },
      };
    },
  };
}

describe("runBenchmark", () => {
  it("runs each task over its prompts and summarises the scores", async () => {
    const config = PROVIDERS[0];
    if (!config) throw new Error("no providers");
    const run = await runBenchmark({
      set,
      providers: [{ config, llm: fakeLlm() }],
      tasks: ["recognition", "lesson", "safety"],
      loadImage: async () => new Uint8Array([1]),
      now: () => new Date("2026-10-27T12:00:00Z"),
    });
    const summary = summarise(run);
    const row = (task: string) => summary.find((item) => item.task === task);

    expect(run.records.every((record) => record.ok)).toBe(true);
    expect(row("recognition")?.runs).toBe(promptsFor("recognition", set.prompts).length);
    expect(row("lesson")?.metrics).toEqual({
      schemaValid: 1,
      allEightModules: 1,
      citationsResolve: 1,
      derivesAnswer: 1,
      threePlusGuesses: 1,
      guessesFit: null,
    });
    expect(row("safety")?.metrics.riskyHandledSafely).toBe(0);
    expect(row("safety")?.metrics.overRefusal).toBe(0);
    expect(row("recognition")?.costUsd).toBeGreaterThan(0);
    expect(summaryMarkdown(run, summary)).toContain("| meta-spark |");
    expect(rubricCsv(run).split("\n")[1]).toMatch(/^seed-\d{3},meta-spark,/);
  });

  it("records provider failures instead of aborting the run", async () => {
    const config = PROVIDERS[0];
    if (!config) throw new Error("no providers");
    const failing: LlmProvider = {
      id: "down",
      model: "down-1",
      complete: async () => {
        throw new Error("HTTP 503");
      },
    };
    const run = await runBenchmark({
      set,
      providers: [{ config, llm: failing }],
      tasks: ["safety"],
      loadImage: async () => new Uint8Array(),
      limit: 2,
    });

    expect(run.records).toHaveLength(2);
    expect(run.records[0]).toMatchObject({ ok: false, error: "HTTP 503" });
    expect(summarise(run)[0]?.errors).toBe(2);
  });
});

describe("scoreLesson", () => {
  it("joins a module's steps into one contract section", () => {
    const sections = stepsToSections(draft.steps);
    expect(sections.map((section) => section.module)).toEqual([
      ...new Set(draft.steps.map((step) => step.module)),
    ]);
    expect(sections).toHaveLength(LessonModule.options.length);
    expect(sections.find((section) => section.module === "first-principles")?.text).toContain(
      "What follows? Because.",
    );
  });

  it("fails a lesson that states the answer without deriving it", () => {
    const flat = {
      ...draft,
      steps: draft.steps.filter((step) => step.module !== "first-principles"),
    };
    const score = scoreLesson(flat, {});
    expect(score.derivesAnswer).toBe(false);
    expect(score.schemaValid).toBe(false);
  });
});

describe("placeGuess", () => {
  it("puts the correct answer among the wrong ones and points at it", () => {
    for (const question of ["Why?", "Which way does it turn?", "What happens next here?"]) {
      const placed = placeGuess({ question, why: "Because.", correct: "Right", wrong: ["A", "B"] });
      expect(placed.options).toHaveLength(3);
      expect(placed.options[placed.answer]).toBe("Right");
    }
  });
});

describe("judgeGuesses", () => {
  it("reports guesses whose options don't answer the question", async () => {
    const judge: LlmProvider = {
      id: "judge",
      model: "judge-1",
      complete: async () => ({
        text: JSON.stringify({
          verdicts: [
            { index: 0, fits: true, problem: null },
            { index: 1, fits: false, problem: "Options compare air, not the plunger." },
            { index: 2, fits: true, problem: null },
          ],
        }),
        model: "judge-1",
        latencyMs: 10,
        usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
      }),
    };
    const judgement = await judgeGuesses(judge, draft);
    expect(judgement).toMatchObject({ checked: 3, fits: 2 });
    expect(judgement.problems[0]?.problem).toMatch(/plunger/);
  });
});
