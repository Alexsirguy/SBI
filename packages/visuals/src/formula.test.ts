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

  it("knows every function the generated formulas use", () => {
    // From the 256 formulas in 112 stored manifests on 2026-11-01, plus near relatives.
    const used = "sqrt(9) + min(1, 2) + max(1, 2) + cos(0) + exp(0) + abs(-1) + sin(0) + log(1)";
    const more = "round(1.4) + atan(0) + floor(1.5) + acos(1) + tan(0) + mod(5, 3) + x ^ 2";
    expect(evaluate(`${used} + ${more}`, { x: 3 })).toBeCloseTo(
      3 + 1 + 2 + 1 + 1 + 1 + 0 + 0 + 1 + 0 + 1 + 0 + 0 + 2 + 9,
    );
    expect(evaluate("e ^ 0 + log10(100) + hypot(3, 4) + sign(-2) + ceil(0.2)", {})).toBe(8);
  });

  it.each(["config({})", "typed(1)", "derivative(x, x)", "det(x)", "factory(1)"])(
    "refuses mathjs internals and functions outside arithmetic: %s",
    (formula) => {
      const compiled = compileFormula(formula, ["x"]);
      expect("error" in compiled && compiled.error).toMatch(/unknown name/);
    },
  );

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
