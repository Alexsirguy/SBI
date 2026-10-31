// Open textbooks write maths as LaTeX source for a typesetter; learners should never see it.
const SYMBOLS: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  Delta: "Δ",
  delta: "δ",
  theta: "θ",
  lambda: "λ",
  mu: "μ",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  omega: "ω",
  Omega: "Ω",
  times: "×",
  cdot: "·",
  approx: "≈",
  leq: "≤",
  geq: "≥",
  neq: "≠",
  pm: "±",
  degree: "°",
  circ: "°",
  rightarrow: "→",
  to: "→",
};

/** Plain words and symbols from text that may carry LaTeX maths markup. */
export function readableText(text: string): string {
  return (
    text
      .replace(/\\PageIndex\{([^{}]*)\}/g, "$1")
      .replace(/\\(?:text|mathrm|textrm|mathbf|textbf|mathit|operatorname)\{([^{}]*)\}/g, "$1")
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")
      .replace(/\\sqrt\{([^{}]*)\}/g, "√($1)")
      .replace(/\\(?:nonumber|notag|left|right|displaystyle|quad|qquad)\b/g, "")
      .replace(/\\[,;:! ]/g, " ")
      .replace(/\\([A-Za-z]+)/g, (whole, name: string) => SYMBOLS[name] ?? whole)
      // Delimiters go last, once nothing inside still needs them.
      .replace(/\\[()[\]]/g, "")
      .replace(/([_^])\{([^{}]*)\}/g, "$1$2")
      .replace(/[ \t]+/g, " ")
      .replace(/ ([,.;:)])/g, "$1")
      .trim()
  );
}
