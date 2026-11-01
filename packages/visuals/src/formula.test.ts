import { describe, expect, it } from "vitest";
import { compileFormula, formatNumber } from "./formula";

function evaluate(formula: string, scope: Record<string, number>, names = Object.keys(scope)) {
  const compiled = compileFormula(formula, names);
  if ("error" in compiled) throw new Error(compiled.error);
  return compiled.evaluate(scope);
}

describe("compileFormula", () => {
  it("does arithmetic on the slider names it is given", () => {
    expect(evaluate("mass * 4190 * 80 / power", { mass: 1, power: 2000 })).toBeCloseTo(167.6);
    expect(evaluate("min(20 + t, 100)", { t: 120 })).toBe(100);
    expect(evaluate("2 * pi * r", { r: 1 })).toBeCloseTo(6.283);
  });

  it.each([
    ["an unknown name", "mass * gravity", /unknown name "gravity"/],
    ["assignment", "mass = 3", /AssignmentNode/],
    ["a function definition", "f(x) = x^2", /FunctionAssignmentNode/],
    ["mathjs's own import", "import({ x: 1 })", /unknown name "import"|not arithmetic/],
    ["evaluate from inside a formula", 'evaluate("1+1")', /unknown name "evaluate"|not arithmetic/],
    ["a call on something that is not a function", "mass(2)", /unknown name "mass"/],
    ["text that does not parse", "mass *", /does not parse/],
  ])("refuses %s", (_case, formula, message) => {
    const compiled = compileFormula(formula, ["mass"]);
    expect("error" in compiled && compiled.error).toMatch(message);
  });

  it("throws on a result that is not a finite number", () => {
    expect(() => evaluate("1 / mass", { mass: 0 })).toThrow(/finite/);
  });
});

describe("formatNumber", () => {
  it("rounds to three significant figures", () => {
    expect(formatNumber(167.6)).toBe("168");
    expect(formatNumber(0.012345)).toBe("0.0123");
    expect(formatNumber(12345)).toBe("12,300");
    expect(formatNumber(0)).toBe("0");
  });
});
