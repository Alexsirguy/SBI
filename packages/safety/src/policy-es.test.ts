import { describe, expect, it } from "vitest";
import { ageHold, categoryNotice, CATEGORY_NOTICES, policyResponse } from "./policy";
import { CATEGORY_NOTICES_ES, isSpanish, REDIRECTS_ES } from "./policy-es";

describe("Spanish safety texts", () => {
  it("covers every category the English does", () => {
    expect(Object.keys(CATEGORY_NOTICES_ES).sort()).toEqual(Object.keys(CATEGORY_NOTICES).sort());
    for (const redirect of Object.values(REDIRECTS_ES))
      expect(redirect.help.length).toBeGreaterThan(0);
  });

  it("answers in Spanish for any es tag, and in English otherwise", () => {
    expect(policyResponse("weapons", "es").message).toMatch(/^No podemos ayudar/);
    expect(policyResponse("weapons", "es-MX").message).toMatch(/^No podemos ayudar/);
    expect(policyResponse("weapons", "en-GB").message).toMatch(/^We can't help/);
    expect(policyResponse(undefined, "es").help[0]).toMatch(/^Pregunta/);
    expect(categoryNotice("medical", "es")).toMatch(/^Salud y medicamentos/);
    expect(isSpanish("fr")).toBe(false);
  });

  it("keeps the same policy fields whatever the language", () => {
    const hold = ageHold("child", { categories: [], suitableFor: "adult" }, "es");
    expect(hold).toMatchObject({ reason: "age", suitableFor: "adult" });
    expect(hold?.message).toMatch(/^Esta pregunta es para adultos/);
    expect(
      ageHold("child", { categories: ["self-harm"], suitableFor: "teen" }, "es")?.message,
    ).toMatch(/^Parece que/);
  });
});
