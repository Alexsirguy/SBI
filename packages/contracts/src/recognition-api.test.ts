import { describe, expect, it } from "vitest";
import {
  LearnerCandidate,
  NextStep,
  RecognisedPhoto,
  RecordSelectionRequest,
} from "./recognition-api";

const RESULT = "0192f1a0-0000-7000-9000-000000000005";
const SESSION = "0192f1a0-0000-7000-8000-000000000011";

describe("recognition API contracts", () => {
  it("never sends the calibrated score to learners", () => {
    const candidate = LearnerCandidate.parse({
      taxonomyId: "object.bicycle",
      label: "Bicycle",
      certainty: "likely",
      calibratedConfidence: 0.93,
      reasons: ["two wheels"],
    });

    expect(candidate).not.toHaveProperty("calibratedConfidence");
    expect(candidate.parts).toEqual([]);
  });

  it("accepts an object choice or trimmed free text, nothing else", () => {
    const resultId = RESULT;
    expect(
      RecordSelectionRequest.parse({
        resultId,
        selection: { kind: "free-text", text: " a trike " },
      }).selection,
    ).toEqual({ kind: "free-text", text: "a trike" });
    expect(
      RecordSelectionRequest.safeParse({ resultId, selection: { kind: "free-text", text: "  " } })
        .success,
    ).toBe(false);
    expect(
      RecordSelectionRequest.safeParse({
        resultId,
        selection: { kind: "object", taxonomyId: "bad id" },
      }).success,
    ).toBe(false);
  });

  it("accepts each next step", () => {
    const fallback = {
      taxonomyId: "category.heating",
      label: "Heating and cooking",
      alternatives: ["Mug", "Cup"],
      assumption: "We could not tell…",
    };
    for (const next of [
      { kind: "proceed", taxonomyId: "object.bicycle" },
      {
        kind: "ask",
        question: "Is it a mug?",
        options: [{ label: "Mug", taxonomyId: "object.mug" }],
      },
      { kind: "assume-category", fallback },
      { kind: "describe" },
    ]) {
      expect(NextStep.safeParse(next).success).toBe(true);
    }
    expect(NextStep.safeParse({ kind: "ask", question: "?", options: [] }).success).toBe(false);
  });

  it("parses a full reply and defaults other labels to none", () => {
    expect(
      RecognisedPhoto.parse({
        resultId: RESULT,
        sessionId: SESSION,
        candidates: [],
        next: { kind: "describe" },
      }).otherLabels,
    ).toEqual([]);
  });
});
