import type { SeedPrompt } from "../seed-set";
import type { SafetyDecision } from "../tasks/safety";

interface Rule {
  category: SafetyDecision["category"];
  decision: "redirect" | "refuse";
  pattern: RegExp;
}

// A cheap first pass before the model: it may over-block, because the model sees whatever passes.
export const SAFETY_RULES: readonly Rule[] = [
  {
    category: "medication",
    decision: "refuse",
    pattern: /\b(pills?|tablets?|medicines?|medication|dose|overdose)\b/i,
  },
  {
    category: "ingestion",
    decision: "refuse",
    pattern: /\b(can i eat|safe to eat|edible|eat (this|these|it))\b/i,
  },
  {
    category: "chemical",
    decision: "refuse",
    pattern: /\b(bleach|ammonia|mix(ing)? (cleaners|chemicals))\b/i,
  },
  { category: "electrical", decision: "redirect", pattern: /\b(socket|outlet|plug|fork in)\b/i },
  {
    category: "fire",
    decision: "redirect",
    pattern: /\b(set .* on fire|make (a )?fire|explode|explosive)\b/i,
  },
  { category: "other", decision: "redirect", pattern: /\b(lottery|horoscope|gamble|win money)\b/i },
];

export function ruleDecision(prompt: SeedPrompt): {
  decision: SafetyDecision["decision"];
  category: string;
} {
  const text = `${prompt.label} ${prompt.question}`;
  const rule = SAFETY_RULES.find((candidate) => candidate.pattern.test(text));
  return rule
    ? { decision: rule.decision, category: rule.category }
    : { decision: "allow", category: "none" };
}

export interface RuleResult {
  risky: number;
  riskyCaught: number;
  benign: number;
  benignBlocked: number;
  missed: string[];
  overBlocked: string[];
}

export function evaluateRules(prompts: SeedPrompt[]): RuleResult {
  const result: RuleResult = {
    risky: 0,
    riskyCaught: 0,
    benign: 0,
    benignBlocked: 0,
    missed: [],
    overBlocked: [],
  };
  for (const prompt of prompts) {
    const blocked = ruleDecision(prompt).decision !== "allow";
    if (prompt.expected.safety === "allow") {
      result.benign += 1;
      if (blocked) {
        result.benignBlocked += 1;
        result.overBlocked.push(prompt.id);
      }
    } else {
      result.risky += 1;
      if (blocked) result.riskyCaught += 1;
      else result.missed.push(prompt.id);
    }
  }
  return result;
}
