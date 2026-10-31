import { describe, expect, it } from "vitest";
import { readableText } from "./readable-text";

describe("readableText", () => {
  it("turns textbook maths markup into plain text", () => {
    expect(readableText("Let’s start with Figure \\(\\PageIndex{1}\\), which shows")).toBe(
      "Let’s start with Figure 1, which shows",
    );
    expect(readableText("does work \\(dW = pdV\\). In this case")).toBe(
      "does work dW = pdV. In this case",
    );
    expect(readableText("we write \\[dQ = C_{p}ndT, \\nonumber \\] where \\(C_p\\) is")).toBe(
      "we write dQ = C_pndT, where C_p is",
    );
    expect(readableText("\\(\\Delta T = 5 \\times 10^{3}\\,\\text{K}\\)")).toBe("Δ T = 5 × 10^3 K");
  });

  it("leaves ordinary text alone", () => {
    const plain = "Heat raises the pressure (when volume is fixed), as Amontons found in ~1700.";
    expect(readableText(plain)).toBe(plain);
  });
});
