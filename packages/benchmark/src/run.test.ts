import type { CompletionRequest, LlmProvider } from "@sbi/llm";
import { describe, expect, it } from "vitest";
import { PROVIDERS } from "./providers";
import { rubricCsv, summarise, summaryMarkdown } from "./report";
import { promptsFor, runBenchmark } from "./run";
import { loadSeedSet } from "./seed-set";
import type { LessonDraft } from "./tasks/lesson";
import { LessonModule } from "@sbi/contracts";

const set = loadSeedSet();

const draft: LessonDraft = {
  title: "How it works",
  summary: "A short summary.",
  learningObjectives: ["Explain the idea"],
  misconceptionNotes: [],
  concepts: [{ conceptId: "energy", label: "Energy" }],
  sections: LessonModule.options.map((module) => ({
    module,
    text: `${module} text`,
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
            ? draft
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
