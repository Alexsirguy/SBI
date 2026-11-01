import {
  absDependencies,
  acosDependencies,
  addDependencies,
  asinDependencies,
  atan2Dependencies,
  atanDependencies,
  cbrtDependencies,
  ceilDependencies,
  cosDependencies,
  coshDependencies,
  create,
  divideDependencies,
  eDependencies,
  equalDependencies,
  expDependencies,
  floorDependencies,
  hypotDependencies,
  largerDependencies,
  largerEqDependencies,
  log10Dependencies,
  log2Dependencies,
  logDependencies,
  maxDependencies,
  minDependencies,
  modDependencies,
  multiplyDependencies,
  parseDependencies,
  piDependencies,
  powDependencies,
  roundDependencies,
  signDependencies,
  sinDependencies,
  sinhDependencies,
  smallerDependencies,
  smallerEqDependencies,
  sqrtDependencies,
  subtractDependencies,
  tanDependencies,
  tanhDependencies,
  unaryMinusDependencies,
  unaryPlusDependencies,
  unequalDependencies,
  type FactoryFunctionMap,
  type MathNode,
} from "mathjs/number";

// Only what readout formulas use (seen in every stored manifest), so a visual does not carry all
// of mathjs; the comparisons let a ConditionalNode such as "x > 1 ? a : b" evaluate.
const DEPENDENCIES = {
  absDependencies,
  acosDependencies,
  addDependencies,
  asinDependencies,
  atan2Dependencies,
  atanDependencies,
  cbrtDependencies,
  ceilDependencies,
  cosDependencies,
  coshDependencies,
  divideDependencies,
  eDependencies,
  equalDependencies,
  expDependencies,
  floorDependencies,
  hypotDependencies,
  largerDependencies,
  largerEqDependencies,
  log10Dependencies,
  log2Dependencies,
  logDependencies,
  maxDependencies,
  minDependencies,
  modDependencies,
  multiplyDependencies,
  parseDependencies,
  piDependencies,
  powDependencies,
  roundDependencies,
  signDependencies,
  sinDependencies,
  sinhDependencies,
  smallerDependencies,
  smallerEqDependencies,
  sqrtDependencies,
  subtractDependencies,
  tanDependencies,
  tanhDependencies,
  unaryMinusDependencies,
  unaryPlusDependencies,
  unequalDependencies,
};
// The typings mark every dependency map optional; each one here is a real export.
const math = create(DEPENDENCIES as Record<keyof typeof DEPENDENCIES, FactoryFunctionMap>);
const parse = math.parse;

// The instance also carries config, typed, import and the like, so callable names are listed.
const FUNCTIONS = new Set([
  "abs",
  "acos",
  "asin",
  "atan",
  "atan2",
  "cbrt",
  "ceil",
  "cos",
  "cosh",
  "exp",
  "floor",
  "hypot",
  "log",
  "log10",
  "log2",
  "max",
  "min",
  "mod",
  "round",
  "sign",
  "sin",
  "sinh",
  "sqrt",
  "tan",
  "tanh",
]);

const ALLOWED_NODES = new Set([
  "ConstantNode",
  "SymbolNode",
  "OperatorNode",
  "ParenthesisNode",
  "FunctionNode",
  "ConditionalNode",
]);

const CONSTANTS = new Set(["pi", "e"]);

function isFunctionName(name: string): boolean {
  return FUNCTIONS.has(name);
}

export interface CompiledFormula {
  evaluate(scope: Record<string, number>): number;
}

/** Parses a formula that may only do arithmetic on the given names, or says why it can't. */
export function compileFormula(
  formula: string,
  names: readonly string[],
): CompiledFormula | { error: string } {
  let node: MathNode;
  try {
    node = parse(formula);
  } catch (error) {
    return { error: `formula "${formula}" does not parse: ${(error as Error).message}` };
  }
  const known = new Set(names);
  let problem: string | undefined;
  node.traverse((child, _path, parent) => {
    if (problem) return;
    if (!ALLOWED_NODES.has(child.type)) {
      problem = `formula "${formula}" uses ${child.type}, which is not arithmetic`;
      return;
    }
    if (child.type !== "SymbolNode") return;
    const name = (child as unknown as { name: string }).name;
    const called =
      parent?.type === "FunctionNode" && (parent as unknown as { fn: MathNode }).fn === child;
    if (called ? !isFunctionName(name) : !known.has(name) && !CONSTANTS.has(name)) {
      problem = `formula "${formula}" uses unknown name "${name}"`;
    }
  });
  if (problem) return { error: problem };
  const compiled = node.compile();
  return {
    evaluate(scope) {
      const value: unknown = compiled.evaluate({ ...scope });
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`formula "${formula}" did not give a finite number`);
      }
      return value;
    },
  };
}

/** Rounds a readout to three significant figures, which is as precise as a simplified model is. */
export function formatNumber(value: number): string {
  return value.toLocaleString("en-GB", { maximumSignificantDigits: 3 });
}
