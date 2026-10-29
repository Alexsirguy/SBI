import type { TaxonomyMatch } from "@sbi/contracts";
import {
  DEFAULT_RANKING_CONFIG,
  gateLesson,
  type RankedRecognition,
  type RankingConfig,
} from "./ranking";

/** Structural subset of `@sbi/taxonomy`'s `Taxonomy` used to compare what lessons would teach. */
export interface ClarifyTaxonomy {
  ancestors(id: string): { id: string; label: string }[];
  concepts(id: string): string[];
}

export interface CategoryFallback {
  taxonomyId: string;
  label: string;
  /** Labels the learner might have meant; the lesson must not claim any one of them. */
  alternatives: string[];
  assumption: string;
}

export type Clarification =
  | { kind: "proceed"; candidate: RankedRecognition["candidates"][number] }
  | { kind: "ask"; question: string; options: TaxonomyMatch[]; fallback?: CategoryFallback }
  | { kind: "assume-category"; fallback: CategoryFallback }
  | { kind: "describe" };

export const NOT_SURE = "not-sure";

export type ClarificationAnswer =
  | {
      kind: "confirmed";
      taxonomyId: string;
      correction: { kind: "selected-alternative"; taxonomyId: string };
    }
  | { kind: "assume-category"; fallback: CategoryFallback }
  | { kind: "describe" };

const MAX_OPTIONS = 3;

// Plural labels like "Salt crystals" read wrongly with "a"; "glass" and "bus" are singular.
function withArticle(label: string) {
  const noun = label.toLowerCase();
  if (/[^su]s$/.test(noun)) return noun;
  return `${/^[aeiou]/.test(noun) ? "an" : "a"} ${noun}`;
}

function either(labels: string[], joiner: "or" | "and") {
  const phrases = labels.map(withArticle);
  return phrases.length === 1
    ? (phrases[0] ?? "")
    : `${phrases.slice(0, -1).join(", ")} ${joiner} ${phrases.at(-1)}`;
}

// Only a category every contender belongs to can be taught without claiming which one it is.
function sharedCategory(ids: string[], taxonomy: ClarifyTaxonomy) {
  const [first, ...rest] = ids.map((id) => taxonomy.ancestors(id));
  return first?.find((ancestor) => rest.every((chain) => chain.some((a) => a.id === ancestor.id)));
}

function sameLesson(ids: string[], taxonomy: ClarifyTaxonomy) {
  const [first, ...rest] = ids.map((id) => [...new Set(taxonomy.concepts(id))].sort().join("|"));
  return rest.every((concepts) => concepts === first);
}

/** Asks only when the answer changes the lesson; otherwise teaches the shared category openly. */
export function planClarification(
  ranked: RankedRecognition,
  taxonomy: ClarifyTaxonomy,
  config: RankingConfig = DEFAULT_RANKING_CONFIG,
): Clarification {
  const gate = gateLesson(ranked, config);
  if (gate.status === "ready") {
    return { kind: "proceed", candidate: gate.candidate };
  }
  const [top] = ranked.candidates;
  if (!top) {
    return { kind: "describe" };
  }
  const contenders = ranked.candidates
    .filter((c) => top.calibratedConfidence - c.calibratedConfidence < config.lessonGate.minMargin)
    .slice(0, MAX_OPTIONS);
  const ids = contenders.map((c) => c.taxonomyId);
  const labels = contenders.map((c) => c.label);
  const category = contenders.length > 1 ? sharedCategory(ids, taxonomy) : undefined;
  const fallback = category && {
    taxonomyId: category.id,
    label: category.label,
    alternatives: labels,
    assumption: `We could not tell if this is ${either(labels, "or")}, so this lesson covers ${category.label.toLowerCase()}, which is true of ${labels.length === 2 ? "both" : "all of them"}.`,
  };
  if (fallback && sameLesson(ids, taxonomy)) {
    return { kind: "assume-category", fallback };
  }
  return {
    kind: "ask",
    question: `Is it ${either(labels, "or")}?`,
    options: contenders.map(({ taxonomyId, label }) => ({ taxonomyId, label })),
    ...(fallback ? { fallback } : {}),
  };
}

/** Applies the learner's answer; "not sure" never picks a candidate on their behalf. */
export function answerClarification(plan: Clarification, answer: string): ClarificationAnswer {
  if (plan.kind !== "ask") {
    throw new Error(`Nothing to answer for a ${plan.kind} plan`);
  }
  if (answer === NOT_SURE) {
    return plan.fallback
      ? { kind: "assume-category", fallback: plan.fallback }
      : { kind: "describe" };
  }
  if (!plan.options.some((option) => option.taxonomyId === answer)) {
    throw new Error(`${answer} was not offered`);
  }
  return {
    kind: "confirmed",
    taxonomyId: answer,
    correction: { kind: "selected-alternative", taxonomyId: answer },
  };
}
