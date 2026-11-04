import { describe, expect, it } from "vitest";
import type { RecognitionOutcome } from "../vision-llm-recogniser";
import {
  calibration,
  correctionRate,
  labelMatches,
  scoreCase,
  summarise,
  topicMatching,
  type RecognitionCase,
} from "./metrics";
import { gate, reportMarkdown } from "./report";

const kettle: RecognitionCase = {
  id: "seed-003",
  label: "Electric kettle",
  aliases: ["kettle"],
  tags: [],
  expected: { recognition: "confident" },
};
const pills: RecognitionCase = {
  id: "seed-038",
  label: "Medicine tablets",
  aliases: [],
  tags: ["high-risk", "unsupported"],
  expected: { recognition: "unsupported" },
};

function outcome(
  status: RecognitionOutcome["status"],
  candidates: [string, number, "likely" | "possible" | "unsure"][],
): RecognitionOutcome {
  return {
    status,
    candidates: candidates.map(([label, calibratedConfidence, certainty]) => ({
      label,
      calibratedConfidence,
      certainty,
    })),
    observations: [],
    provider: "fake",
    model: "fake",
    promptVersion: "p",
    latencyMs: 1,
    usage: { inputTokens: 0, outputTokens: 0 },
  } as unknown as RecognitionOutcome;
}

describe("recognition evaluation (#79)", () => {
  it("matches labels by name or alias, either way round", () => {
    expect(labelMatches("kettle", kettle)).toBe(true);
    expect(labelMatches("stainless electric kettle", kettle)).toBe(true);
    expect(labelMatches("teapot", kettle)).toBe(false);
  });

  it("scores top-k, confidence and abstention", () => {
    const right = scoreCase(
      kettle,
      outcome("recognised", [
        ["Teapot", 0.6, "possible"],
        ["Kettle", 0.3, "unsure"],
      ]),
    );
    expect(right).toMatchObject({ top1: false, top3: true, confidence: 0.6, abstained: true });
    const held = scoreCase(pills, outcome("unsupported", []));
    expect(held).toMatchObject({ abstained: true, conditions: ["high-risk", "unsupported"] });
  });

  it("measures calibration as the gap between stated confidence and accuracy", () => {
    const perfect = calibration([
      { confidence: 0.9, top1: true },
      { confidence: 0.9, top1: true },
    ]);
    expect(perfect.ece).toBeCloseTo(0.1);
    const overconfident = calibration([
      { confidence: 0.95, top1: false },
      { confidence: 0.95, top1: false },
    ]);
    expect(overconfident.ece).toBeCloseTo(0.95);
  });

  it("summarises accuracy over labelled photos and abstention over the ones to hold back", () => {
    const scores = [
      scoreCase(kettle, outcome("recognised", [["Kettle", 0.9, "likely"]])),
      scoreCase(pills, outcome("recognised", [["Sweets", 0.8, "likely"]])),
    ];
    const summary = summarise(scores, [kettle, pills]);
    expect(summary.top1Accuracy).toBe(1);
    // The medicine was named confidently instead of held back: a miss that matters.
    expect(summary.abstentionRecall).toBe(0);
    expect(summary.byCondition["clear-photo"]).toEqual({ cases: 1, top3Accuracy: 1, abstained: 0 });
  });

  it("counts corrections among results where the learner chose", () => {
    expect(
      correctionRate([
        { selectedTaxonomyId: "object.kettle" },
        { userCorrection: { kind: "free-text", text: "a samovar" } as never },
        {},
      ]),
    ).toMatchObject({
      results: 3,
      decided: 2,
      corrected: 1,
      rate: 0.5,
      byKind: { "free-text": 1 },
    });
  });

  it("finds false reuses: one lesson served for two different questions", () => {
    const topic = topicMatching(
      [
        { a: "x", b: "x", sameIntent: true, note: "same" },
        { a: "y", b: "y", sameIntent: false, note: "looks the same, isn't" },
        { a: "p", b: "q", sameIntent: true, note: "paraphrase" },
      ],
      (a, b) => a === b,
    );
    expect(topic).toMatchObject({ precision: 0.5, recall: 0.5, falseReuseRate: 1 });
    expect(topic.falseReuses).toEqual(["looks the same, isn't"]);
  });

  it("fails the gate on a false reuse, and reports it", () => {
    const scores = [scoreCase(kettle, outcome("recognised", [["Kettle", 0.9, "likely"]]))];
    const summary = summarise(scores, [kettle]);
    const topic = topicMatching([{ a: 1, b: 1, sameIntent: false, note: "bad" }], () => true);
    expect(gate(summary, topic).find((row) => row.metric === "falseReuseRate")?.passed).toBe(false);
    expect(
      reportMarkdown({ runAt: "now", seedSet: "v2", providers: "fake" }, summary, topic, scores),
    ).toContain("- false reuse: bad");
  });
});
