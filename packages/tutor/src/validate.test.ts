import { describe, expect, it } from "vitest";
import { REPLY_MAX_CHARS, validateAnswer } from "./validate";
import { BOILING, CLAIMS, ELEMENT } from "./test-lesson";

describe("validateAnswer", () => {
  it("maps fact numbers back to the retrieved claims' IDs, once each", () => {
    const checked = validateAnswer(
      { text: " Less  pressure. ", cited: ["f2", "F2", "f1"] },
      CLAIMS,
    );
    expect(checked).toEqual({
      ok: true,
      text: "Less pressure.",
      citedClaimIds: [BOILING.claimId, ELEMENT.claimId],
    });
  });

  it("rejects a citation of a fact that was not retrieved", () => {
    expect(validateAnswer({ text: "Yes.", cited: ["f9"] }, CLAIMS)).toEqual({
      ok: false,
      reason: "unknown-citation",
    });
  });

  it("rejects empty and lecture-length replies", () => {
    expect(validateAnswer({ text: "  ", cited: [] }, CLAIMS)).toMatchObject({ reason: "empty" });
    const long = "word ".repeat(REPLY_MAX_CHARS);
    expect(validateAnswer({ text: long, cited: [] }, CLAIMS)).toMatchObject({ reason: "too-long" });
  });
});
