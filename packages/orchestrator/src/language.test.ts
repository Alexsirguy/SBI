import { describe, expect, it } from "vitest";
import { languageRule } from "./language";

describe("languageRule", () => {
  it("adds nothing for English, so English prompts stay byte-identical", () => {
    expect(languageRule("en")).toBe("");
    expect(languageRule("en-GB")).toBe("");
    expect(languageRule(undefined)).toBe("");
  });

  it("asks for Spanish learner-facing text while keeping ids and keys in English", () => {
    expect(languageRule("es")).toMatch(/Spanish \(español\)/);
    expect(languageRule("es")).toMatch(/JSON keys/);
  });
});
