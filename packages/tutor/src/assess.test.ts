import { describe, expect, it } from "vitest";
import { assessTurn } from "./assess";
import { classifierSaying } from "./test-lesson";

const input = {
  subject: "Kettle",
  text: "How hot does it get?",
  audience: "child" as const,
  locale: "en",
};

describe("assessTurn", () => {
  it("lets an everyday question through and records no category", async () => {
    expect(await assessTurn(classifierSaying(), input)).toEqual({
      decision: "answer",
      category: "none",
    });
  });

  it("answers harmful intent with the safety policy instead of the model", async () => {
    const assessment = await assessTurn(
      classifierSaying({ intent: "harm", categories: ["weapons"], safetyClass: "high" }),
      input,
    );
    expect(assessment).toMatchObject({ decision: "policy", category: "weapons" });
    expect(assessment.decision === "policy" && assessment.policy.reason).toBe("harm");
  });

  it("holds a question meant for older learners, as lessons do", async () => {
    const assessment = await assessTurn(
      classifierSaying({ categories: ["medical"], suitableFor: "adult", safetyClass: "high" }),
      input,
    );
    expect(assessment).toMatchObject({ decision: "policy", category: "medical" });
  });

  it("asks the classifier about this lesson's subject and the learner's words", async () => {
    const seen: unknown[] = [];
    await assessTurn(async (risk) => {
      seen.push(risk);
      return classifierSaying()(risk);
    }, input);
    expect(seen).toEqual([{ subject: "Kettle", question: "How hot does it get?" }]);
  });
});
