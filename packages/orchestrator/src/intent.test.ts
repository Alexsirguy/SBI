import { describe, expect, it } from "vitest";
import { buildIntentSignature, type IntentInput } from "./intent";

const base: IntentInput = {
  question: "Why does my kettle click off?",
  taxonomyId: "home.kettle",
  conceptIds: ["thermostat", "boiling"],
  audience: "general",
  readingLevel: "plain",
  locale: "en-GB",
  safetyScope: "low",
};

describe("buildIntentSignature", () => {
  it("is deterministic and looks like a SHA-256 digest", () => {
    const first = buildIntentSignature(base);

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(buildIntentSignature({ ...base })).toBe(first);
  });

  it("changes when any captured dimension changes", () => {
    const signatures = new Set([
      buildIntentSignature({ ...base, question: "Why does my kettle boil?" }),
      buildIntentSignature({ ...base, taxonomyId: "home.toaster" }),
      buildIntentSignature({ ...base, conceptIds: ["thermostat"] }),
      buildIntentSignature({ ...base, audience: "child" }),
      buildIntentSignature({ ...base, readingLevel: "simple" }),
      buildIntentSignature({ ...base, locale: "fr" }),
      buildIntentSignature({ ...base, safetyScope: "high" }),
    ]);

    expect(signatures.size).toBe(7);
    expect(signatures.has(buildIntentSignature(base))).toBe(false);
  });

  it("ignores case, whitespace and concept order", () => {
    expect(
      buildIntentSignature({
        ...base,
        question: "  WHY does  my kettle\nCLICK off? ",
        conceptIds: ["boiling", "thermostat", "boiling"],
      }),
    ).toBe(buildIntentSignature(base));
  });
});
