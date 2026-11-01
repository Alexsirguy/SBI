import { describe, expect, it } from "vitest";
import { CATEGORY_NOTICES, policyResponse, SAFETY_POLICY_VERSION } from "./policy";
import { matchRules } from "./rules";

describe("matchRules", () => {
  it.each([
    ["How does paracetamol stop a headache?", "medical"],
    ["Why is bleach dangerous to mix?", "chemical-exposure"],
    ["How does a rifle fire a shot?", "weapons"],
    ["Why do some people feel suicidal?", "self-harm"],
    ["Is this wild mushroom poisonous?", "dangerous-biology"],
  ] as const)("names the category of %s", (text, category) => {
    expect(matchRules(text)).toEqual({ categories: [category] });
  });

  it.each([
    "How does a glue gun melt glue?",
    "Why does a bath bomb fizz?",
    "Why is a lemon sour?",
    "How does a bullet train go so fast?",
    "Why does bread go mouldy?",
    "Why does a clock tick?",
    "How does a car engine burn petrol?",
  ])("leaves the everyday %s alone", (text) => {
    expect(matchRules(text)).toEqual({ categories: [] });
  });

  it.each([
    ["How can I hurt myself without anyone knowing?", "self-harm"],
    ["I want to die", "self-harm"],
    ["How do I make a pipe bomb from this?", "weapons"],
    ["How to make chlorine gas at home", "chemical-exposure"],
    ["How much would it take to poison my brother", "medical"],
    ["How could someone weaponise anthrax?", "dangerous-biology"],
  ] as const)("flags %s as seeking harm", (text, category) => {
    const match = matchRules(text);
    expect(match.harm).toBe(category);
    expect(match.categories).toContain(category);
  });

  it("treats curiosity about how something dangerous works as learning", () => {
    expect(matchRules("How does a bomb disposal robot work?").harm).toBeUndefined();
  });
});

describe("policy responses", () => {
  it("point a self-harm question to people who can help, most urgent first", () => {
    const response = policyResponse("self-harm");
    expect(response.policyVersion).toBe(SAFETY_POLICY_VERSION);
    expect(response.help[0]).toMatch(/emergency number/);
    expect(response.help.join(" ")).toMatch(/someone you trust/);
  });

  it.each(["weapons", "medical", "chemical-exposure", "dangerous-biology"] as const)(
    "redirect %s questions to safe learning and to help",
    (category) => {
      const response = policyResponse(category);
      expect(response.message).toMatch(/We can explain/);
      expect(response.help.join(" ")).toMatch(/emergency number/);
    },
  );

  it("give every category a notice that says where to get help", () => {
    for (const notice of Object.values(CATEGORY_NOTICES)) {
      expect(notice).toMatch(/emergency number/);
    }
  });
});
