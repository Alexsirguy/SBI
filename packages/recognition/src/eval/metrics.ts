import type { RecognitionResult } from "@sbi/contracts";
import { z } from "zod";
import type { RecognitionOutcome } from "../vision-llm-recogniser";

/** The fields of a seed prompt (docs/research/seed-set) recognition is judged against. */
export const RecognitionCase = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  expected: z.object({ recognition: z.enum(["confident", "ambiguous", "unsupported"]) }),
  // Text-only prompts have no photo and are skipped here.
  image: z.object({ url: z.url(), mime: z.string(), sha256: z.string() }).nullish(),
});
export type RecognitionCase = z.infer<typeof RecognitionCase>;

const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** A label names the object when it contains the label or an alias, or the other way round. */
export function labelMatches(label: string, item: RecognitionCase): boolean {
  const said = normalise(label);
  return [item.label, ...item.aliases]
    .map(normalise)
    .some((name) => name.length > 0 && (said.includes(name) || name.includes(said)));
}

export interface CaseScore {
  caseId: string;
  expected: RecognitionCase["expected"]["recognition"];
  /** Image conditions the case stands for, from its seed tags. */
  conditions: string[];
  status?: RecognitionOutcome["status"];
  top1: boolean;
  top3: boolean;
  /** The model's stated probability for its first candidate. */
  confidence?: number;
  /** Recognition held back: anything but a confident "recognised". */
  abstained: boolean;
  error?: string;
}

/** What an abstention means: the photo should not have produced one confident answer. */
const shouldAbstain = (item: RecognitionCase) => item.expected.recognition !== "confident";

export function scoreCase(item: RecognitionCase, outcome: RecognitionOutcome): CaseScore {
  const labels = outcome.candidates.map((candidate) => candidate.label);
  const top = outcome.candidates[0];
  return {
    caseId: item.id,
    expected: item.expected.recognition,
    conditions: item.tags.length > 0 ? item.tags : ["clear-photo"],
    status: outcome.status,
    top1: labels.length > 0 && labelMatches(labels[0] ?? "", item),
    top3: labels.some((label) => labelMatches(label, item)),
    confidence: top?.calibratedConfidence,
    abstained: outcome.status !== "recognised" || top?.certainty !== "likely",
  };
}

export interface ReliabilityBin {
  from: number;
  to: number;
  count: number;
  meanConfidence: number;
  accuracy: number;
}

/** Expected calibration error: how far stated confidence is from how often it was right. */
export function calibration(
  scores: Pick<CaseScore, "confidence" | "top1">[],
  binCount = 5,
): { ece: number; bins: ReliabilityBin[] } {
  const rated = scores.filter((score) => score.confidence !== undefined);
  const bins = Array.from({ length: binCount }, (_, index) => {
    const from = index / binCount;
    const to = (index + 1) / binCount;
    const inBin = rated.filter((score) => {
      const value = score.confidence ?? 0;
      return value >= from && (index === binCount - 1 ? value <= to : value < to);
    });
    const mean = (values: number[]) =>
      values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
    return {
      from,
      to,
      count: inBin.length,
      meanConfidence: mean(inBin.map((score) => score.confidence ?? 0)),
      accuracy: mean(inBin.map((score) => (score.top1 ? 1 : 0))),
    };
  });
  const ece =
    rated.length === 0
      ? 0
      : bins.reduce(
          (sum, bin) =>
            sum + (bin.count / rated.length) * Math.abs(bin.accuracy - bin.meanConfidence),
          0,
        );
  return { ece, bins };
}

const rate = (hits: number, total: number) => (total === 0 ? 1 : hits / total);

export interface RecognitionSummary {
  cases: number;
  errors: number;
  top1Accuracy: number;
  top3Accuracy: number;
  ece: number;
  bins: ReliabilityBin[];
  /** Of the photos that should be held back, the share that were. */
  abstentionRecall: number;
  /** Of the photos held back, the share that should have been. */
  abstentionPrecision: number;
  byCondition: Record<string, { cases: number; top3Accuracy: number; abstained: number }>;
}

export function summarise(scores: CaseScore[], cases: RecognitionCase[]): RecognitionSummary {
  const byId = new Map(cases.map((item) => [item.id, item]));
  const answered = scores.filter((score) => !score.error);
  // Unsupported photos have no right label, so accuracy is over the others.
  const labelled = answered.filter((score) => score.expected !== "unsupported");
  const should = answered.filter((score) => {
    const item = byId.get(score.caseId);
    return item ? shouldAbstain(item) : false;
  });
  const held = answered.filter((score) => score.abstained);
  const conditions = [...new Set(answered.flatMap((score) => score.conditions))].sort();
  return {
    cases: scores.length,
    errors: scores.length - answered.length,
    top1Accuracy: rate(labelled.filter((s) => s.top1).length, labelled.length),
    top3Accuracy: rate(labelled.filter((s) => s.top3).length, labelled.length),
    ...calibration(labelled),
    abstentionRecall: rate(should.filter((s) => s.abstained).length, should.length),
    abstentionPrecision: rate(held.filter((s) => should.includes(s)).length, held.length),
    byCondition: Object.fromEntries(
      conditions.map((condition) => {
        const inCondition = answered.filter((score) => score.conditions.includes(condition));
        const named = inCondition.filter((score) => score.expected !== "unsupported");
        return [
          condition,
          {
            cases: inCondition.length,
            top3Accuracy: rate(named.filter((s) => s.top3).length, named.length),
            abstained: inCondition.filter((s) => s.abstained).length,
          },
        ];
      }),
    ),
  };
}

/**
 * From stored results: how often learners corrected recognition, among those who chose at all.
 * A correction is a different option picked, or the learner's own words.
 */
export function correctionRate(
  results: Pick<RecognitionResult, "selectedTaxonomyId" | "userCorrection">[],
) {
  const decided = results.filter((result) => result.selectedTaxonomyId || result.userCorrection);
  const corrected = decided.filter((result) => result.userCorrection);
  const byKind: Record<string, number> = {};
  for (const result of corrected) {
    const kind = result.userCorrection?.kind ?? "unknown";
    byKind[kind] = (byKind[kind] ?? 0) + 1;
  }
  return {
    results: results.length,
    decided: decided.length,
    corrected: corrected.length,
    rate: rate(corrected.length, decided.length),
    byKind,
  };
}

export interface TopicPair<Q> {
  a: Q;
  b: Q;
  sameIntent: boolean;
  note: string;
}

/**
 * Topic matching (spec §13): does reuse serve one lesson for two requests only when they ask the
 * same thing? A false reuse shows a learner an answer to someone else's question.
 */
export function topicMatching<Q>(pairs: TopicPair<Q>[], reuses: (a: Q, b: Q) => boolean) {
  const decided = pairs.map((pair) => ({ ...pair, reused: reuses(pair.a, pair.b) }));
  const reused = decided.filter((pair) => pair.reused);
  const different = decided.filter((pair) => !pair.sameIntent);
  const same = decided.filter((pair) => pair.sameIntent);
  return {
    pairs: pairs.length,
    precision: rate(reused.filter((pair) => pair.sameIntent).length, reused.length),
    recall: rate(same.filter((pair) => pair.reused).length, same.length),
    falseReuseRate: rate(different.filter((pair) => pair.reused).length, different.length),
    falseReuses: different.filter((pair) => pair.reused).map((pair) => pair.note),
  };
}

/** The gate in docs/research/recognition-eval/thresholds.md. */
export const THRESHOLDS = {
  top1Accuracy: { min: 0.75 },
  top3Accuracy: { min: 0.9 },
  ece: { max: 0.15 },
  abstentionRecall: { min: 0.9 },
  falseReuseRate: { max: 0 },
} as const;
