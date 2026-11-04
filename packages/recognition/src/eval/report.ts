import { THRESHOLDS, type CaseScore, type RecognitionSummary, type topicMatching } from "./metrics";

type Topic = ReturnType<typeof topicMatching>;
const two = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

/** Which thresholds the run meets; a run with errors never passes. */
export function gate(summary: RecognitionSummary, topic: Topic) {
  const values: Record<keyof typeof THRESHOLDS, number> = {
    top1Accuracy: summary.top1Accuracy,
    top3Accuracy: summary.top3Accuracy,
    ece: summary.ece,
    abstentionRecall: summary.abstentionRecall,
    falseReuseRate: topic.falseReuseRate,
  };
  return Object.entries(THRESHOLDS).map(([metric, limit]) => {
    const value = values[metric as keyof typeof THRESHOLDS];
    return { metric, value, passed: "min" in limit ? value >= limit.min : value <= limit.max };
  });
}

export function reportMarkdown(
  meta: { runAt: string; seedSet: string; providers: string },
  summary: RecognitionSummary,
  topic: Topic,
  scores: CaseScore[],
): string {
  const rows = gate(summary, topic);
  const passed = summary.errors === 0 && rows.every((row) => row.passed);
  return [
    `# Recognition evaluation ${meta.runAt}`,
    "",
    `Seed set ${meta.seedSet}; ${summary.cases} photos, ${summary.errors} errors; providers ${meta.providers}.`,
    "",
    `**Gate: ${passed ? "pass" : "fail"}**`,
    "",
    "| Metric | Result | Gate | |",
    "| --- | --- | --- | --- |",
    ...rows.map(({ metric, value, passed: ok }) => {
      const limit = THRESHOLDS[metric as keyof typeof THRESHOLDS];
      return `| ${metric} | ${two(value)} | ${"min" in limit ? `≥ ${limit.min}` : `≤ ${limit.max}`} | ${ok ? "pass" : "**fail**"} |`;
    }),
    `| abstentionPrecision | ${two(summary.abstentionPrecision)} | reported | |`,
    `| topic precision / recall | ${two(topic.precision)} / ${two(topic.recall)} | reported | |`,
    "",
    "## Calibration (top-1 confidence against how often it was right)",
    "",
    "| Confidence | Photos | Mean confidence | Accuracy |",
    "| --- | --- | --- | --- |",
    ...summary.bins.map(
      (bin) =>
        `| ${two(bin.from)}–${two(bin.to)} | ${bin.count} | ${two(bin.meanConfidence)} | ${two(bin.accuracy)} |`,
    ),
    "",
    "## By image condition",
    "",
    "| Condition | Photos | Top-3 accuracy | Held back |",
    "| --- | --- | --- | --- |",
    ...Object.entries(summary.byCondition).map(
      ([condition, row]) =>
        `| ${condition} | ${row.cases} | ${two(row.top3Accuracy)} | ${row.abstained} |`,
    ),
    "",
    "## Misses",
    "",
    ...scores
      .filter((score) => score.error || (score.expected !== "unsupported" && !score.top3))
      .map(
        (score) =>
          `- ${score.caseId}: ${score.error ?? `expected ${score.expected}, got ${score.status} without the label`}`,
      ),
    ...topic.falseReuses.map((note) => `- false reuse: ${note}`),
    "",
  ].join("\n");
}
