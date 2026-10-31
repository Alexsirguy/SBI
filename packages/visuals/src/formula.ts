import { all, create, type MathNode } from "mathjs";

const math = create(all ?? {});
const parse = math.parse;
// mathjs warns that these can rewrite its own functions, so formulas from the AI never reach them.
const BLOCKED = [
  "import",
  "createUnit",
  "evaluate",
  "parse",
  "simplify",
  "derivative",
  "resolve",
  "reviver",
  "compile",
];
math.import(
  Object.fromEntries(
    BLOCKED.map((name) => [
      name,
      () => {
        throw new Error(`${name} is not allowed in a formula`);
      },
    ]),
  ),
  { override: true },
);

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
  return (
    typeof (math as unknown as Record<string, unknown>)[name] === "function" &&
    !BLOCKED.includes(name)
  );
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
