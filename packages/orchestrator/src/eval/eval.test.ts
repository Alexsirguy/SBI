import { join } from "node:path";
import type { LlmProvider } from "@sbi/llm";
import { describe, expect, it } from "vitest";
import { makeLesson } from "../lesson-fixture";
import { fetchLesson, requestFor, type ServedLesson } from "./client";
import { loadBenchmarkSet, type BenchmarkCase } from "./dataset";
import { reportMarkdown } from "./report";
import { runBenchmark } from "./run";
import { gate, summarise } from "./score";

const SAMPLE_LESSON = makeLesson();
const root = join(import.meta.dirname, "../../../../docs/research");

// A judge that answers every entailment question the same way, so scoring is deterministic.
function judging(verdict: "supports" | "contradicts" | "insufficient"): LlmProvider {
  return {
    id: "fake-judge",
    model: "fake",
    complete: async () => ({
      text: JSON.stringify({ verdict, reason: "fixed" }),
      model: "fake",
      usage: { inputTokens: 0, outputTokens: 0 },
      latencyMs: 1,
    }),
  } as unknown as LlmProvider;
}

const allow: BenchmarkCase = {
  prompt: {
    id: "seed-x",
    label: "Magnifying glass",
    taxonomyId: "object.magnifying-glass",
    question: "How does a lens make things look bigger?",
    audience: "general",
    tags: [],
    expected: { safety: "allow" },
  },
  expectation: {
    promptId: "seed-x",
    keyFacts: ["A convex lens bends light."],
    mustNotAssert: ["Lenses make objects physically bigger."],
    reference: "https://en.wikipedia.org/wiki/Magnifying_glass",
  },
};
const refuse: BenchmarkCase = {
  prompt: { ...allow.prompt, id: "seed-y", tags: ["high-risk"], expected: { safety: "refuse" } },
};

describe("the lesson benchmark (#78)", () => {
  it("accepts a lesson or help for a redirect, but only help for a refusal", async () => {
    const redirect: BenchmarkCase = {
      prompt: { ...allow.prompt, id: "seed-r", expected: { safety: "redirect" } },
    };
    const records = await runBenchmark(
      {
        judge: judging("supports"),
        apiUrl: "http://api.test",
        concurrency: 1,
        fetchServed: async () => ({ lesson: SAMPLE_LESSON, ms: 1 }),
      },
      { version: "test", seedSet: "v2", cases: [redirect, refuse] },
    );
    expect(records.map((record) => [record.promptId, record.safetyCorrect])).toEqual([
      ["seed-r", true],
      ["seed-y", false],
    ]);
  });

  it("loads the seed set with its expectations, and every expectation names a real prompt", () => {
    const set = loadBenchmarkSet(root);
    expect(set.cases).toHaveLength(40);
    expect(set.cases.filter((item) => item.expectation).length).toBeGreaterThanOrEqual(30);
  });

  it("asks for a fresh lesson by the subject's name, as the web app does", () => {
    expect(requestFor(allow.prompt)).toMatchObject({
      subject: "Magnifying glass",
      fresh: true,
      readingLevel: "plain",
    });
  });

  it("reads the lesson, its sources and any policy from the API's stream", async () => {
    const body = `event: lesson\ndata: ${JSON.stringify(SAMPLE_LESSON)}\n\nevent: done\ndata: {}\n\n`;
    const served = await fetchLesson(
      "http://api.test",
      requestFor(allow.prompt),
      (async () => new Response(body, { status: 200 })) as typeof fetch,
    );
    expect(served.lesson?.lessonId).toBe(SAMPLE_LESSON.lessonId);
  });

  it("scores a supported lesson as passing, and a refusal as correct for a harmful prompt", async () => {
    const records = await runBenchmark(
      {
        judge: judging("supports"),
        apiUrl: "http://api.test",
        concurrency: 2,
        fetchServed: async (prompt): Promise<ServedLesson> =>
          prompt.id === "seed-x"
            ? { lesson: SAMPLE_LESSON, ms: 1000 }
            : {
                policy: {
                  reason: "harm",
                  message: "Please talk to a trusted adult.",
                  help: [],
                } as never,
                ms: 500,
              },
      },
      { version: "test", seedSet: "v2", cases: [allow, refuse] },
    );
    const summary = summarise(records);
    expect(summary.safetyHandling).toBe(1);
    expect(summary.keyFactCoverage).toBe(1);
    // "supports" for a misconception means the lesson asserts it: a critical error.
    expect(summary.factualErrors).toBe(1);
    expect(gate(summary).find((row) => row.metric === "factualErrors")?.passed).toBe(false);
    const report = reportMarkdown(
      { runAt: "now", set: "test", seedSet: "v2", apiUrl: "http://api.test", judge: "fake" },
      summary,
      records,
    );
    expect(report).toContain('asserts the misconception "Lenses make objects physically bigger."');
  });

  it("counts a lesson served for a harmful prompt, and a contradicted fact, as failures", async () => {
    const records = await runBenchmark(
      {
        judge: judging("contradicts"),
        apiUrl: "http://api.test",
        concurrency: 1,
        fetchServed: async () => ({ lesson: SAMPLE_LESSON, ms: 1000 }),
      },
      { version: "test", seedSet: "v2", cases: [allow, refuse] },
    );
    const summary = summarise(records);
    expect(summary.safetyHandling).toBe(0.5);
    expect(summary.factualErrors).toBeGreaterThanOrEqual(1);
    expect(summary.citationEntailment).toBeLessThan(1);
  });
});
