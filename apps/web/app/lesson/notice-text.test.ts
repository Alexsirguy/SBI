import type { LessonDisclaimer } from "@sbi/contracts";
import { describe, expect, it } from "vitest";
import { cautionText } from "./notice-text";

const note = (kind: LessonDisclaimer["kind"]): LessonDisclaimer => ({
  kind,
  message: `${kind} message`,
  sectionIds: [],
});

describe("cautionText", () => {
  it("says it once, however many doubts the lesson carries", () => {
    expect(
      cautionText([
        note("model-knowledge"),
        note("unverified-sections"),
        note("sources-disagree"),
        note("limited-evidence"),
      ]),
    ).toBe(
      "Some parts of this lesson come from the AI's general knowledge and some are not fully backed by their sources. A reviewer has not checked it yet, so report anything that looks wrong.",
    );
  });

  it("covers each case on its own", () => {
    expect(cautionText([note("model-knowledge")])).toBe(
      "Some parts of this lesson come from the AI's general knowledge. A reviewer has not checked it yet, so report anything that looks wrong.",
    );
    expect(cautionText([note("awaiting-review")])).toBe(
      "A reviewer has not checked this lesson yet, so report anything that looks wrong.",
    );
    expect(cautionText([note("awaiting-review"), note("reading-level")])).toContain(
      "harder to read than the level you chose",
    );
  });

  it("leaves the safety notice to stand on its own", () => {
    expect(cautionText([note("safety")])).toBeUndefined();
  });
});
