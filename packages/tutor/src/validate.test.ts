import { describe, expect, it } from "vitest";
import type { DraftAnswer } from "./answer";
import { REPLY_MAX_CHARS, validateAnswer } from "./validate";
import { BOILING, CLAIMS, ELEMENT } from "./test-lesson";

const draft = (text: string, kind: DraftAnswer["kind"] = "beyond", cited: string[] = []) => ({
  kind,
  text,
  cited,
});

describe("validateAnswer", () => {
  it("maps fact numbers back to the retrieved claims' IDs, once each", () => {
    const checked = validateAnswer(
      { kind: "lesson", text: " Less  pressure. ", cited: ["f2", "F2", "f1"] },
      CLAIMS,
    );
    expect(checked).toEqual({
      ok: true,
      kind: "lesson",
      text: "Less pressure.",
      citedClaimIds: [BOILING.claimId, ELEMENT.claimId],
    });
  });

  it("rejects a citation of a fact that was not retrieved", () => {
    expect(validateAnswer({ kind: "lesson", text: "Yes.", cited: ["f9"] }, CLAIMS)).toEqual({
      ok: false,
      reason: "unknown-citation",
    });
  });

  it("rejects empty and lecture-length replies", () => {
    expect(validateAnswer(draft("  "), CLAIMS)).toMatchObject({ reason: "empty" });
    const long = "word ".repeat(REPLY_MAX_CHARS);
    expect(validateAnswer(draft(long), CLAIMS)).toMatchObject({ reason: "too-long" });
  });

  it("marks every uncited answer beyond the lesson, whatever the model called it", () => {
    expect(validateAnswer(draft("At night it's colder.", "lesson"), CLAIMS)).toMatchObject({
      ok: true,
      kind: "beyond-lesson",
      citedClaimIds: [],
    });
    expect(validateAnswer(draft("It heats.", "beyond", ["f1"]), CLAIMS)).toMatchObject({
      kind: "lesson",
      citedClaimIds: [ELEMENT.claimId],
    });
  });

  it("accepts one short clarifying question, citing nothing, but not two in a row", () => {
    const asked = draft("Do you mean the kettle or the water?", "clarify", ["f1"]);
    expect(validateAnswer(asked, CLAIMS)).toEqual({
      ok: true,
      kind: "clarifying",
      text: "Do you mean the kettle or the water?",
      citedClaimIds: [],
    });
    expect(validateAnswer(asked, CLAIMS, { justClarified: true })).toMatchObject({
      reason: "clarified-twice",
    });
    expect(validateAnswer(draft("Which one? Hot or cold?", "clarify"), CLAIMS)).toMatchObject({
      reason: "not-a-question",
    });
    expect(validateAnswer(draft("It depends.", "clarify"), CLAIMS)).toMatchObject({
      reason: "not-a-question",
    });
  });

  it("rejects a reply that claims to see the learner's photo", () => {
    for (const text of ["I can see your kettle is red.", "En tu foto hay una tetera azul."]) {
      expect(validateAnswer(draft(text), CLAIMS)).toMatchObject({ reason: "claims-to-see" });
    }
  });

  it("rejects a reply asking a child to do something hazardous, but not an adult-only one", () => {
    const risky = draft("Try to taste the wild berries to see if they are sour.");
    expect(validateAnswer(risky, CLAIMS)).toMatchObject({ reason: "unsafe-activity" });
    expect(validateAnswer(risky, CLAIMS, { audience: "adult" })).toMatchObject({ ok: true });
    const advice = draft("Never taste wild berries; some are poisonous.");
    expect(validateAnswer(advice, CLAIMS)).toMatchObject({ ok: true });
  });
});
