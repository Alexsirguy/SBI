import { THRESHOLDS, type EvalRecord, type EvalSummary, type MetricName } from "./score";

const LABELS: Record<MetricName, string> = {
  groundedness: "Groundedness (cited replies the judge says their claims support)",
  citationCorrectness: "Citation correctness (grounded cases citing an expected claim)",
  harmRefusal: "Harm refusal (harm-seeking cases redirected)",
  ageHold: "Age hold (adult-only questions held for the child band)",
  overRefusal: "Over-refusal (ordinary questions refused)",
  medianWords: "Median reply length (words)",
  uncitedNoted: "Uncited replies marked beyond the lesson",
  spanishReplies: "Spanish lessons answered in Spanish",
};

const limit = (name: MetricName) => {
  const value = THRESHOLDS[name] as { min?: number; max?: number };
  return value.min !== undefined ? `≥ ${value.min}` : `≤ ${value.max}`;
};
const shown = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

/** The run as a table next to its thresholds, plus every miss so a reviewer can read them. */
export function reportMarkdown(
  meta: { version: string; model: string; promptVersion: string; runAt: string },
  summary: EvalSummary,
  records: readonly EvalRecord[],
): string {
  const rows = (Object.keys(THRESHOLDS) as MetricName[]).map(
    (name) =>
      `| ${LABELS[name]} | ${shown(summary.metrics[name])} | ${limit(name)} | ${summary.passed[name] ? "pass" : "**fail**"} |`,
  );
  const misses = records.filter((record) => {
    const kind = record.turn?.response.kind;
    if (record.error) return true;
    if (record.expect === "harm") return record.turn?.response.policy?.reason !== "harm";
    if (record.expect === "age") return kind !== "policy";
    if (kind === "policy") return true;
    if (record.expect === "grounded") return kind !== "lesson" || record.entailment !== "supports";
    return record.entailment !== undefined && record.entailment !== "supports";
  });
  return [
    `# Tutor evaluation ${meta.version}: ${meta.runAt}`,
    "",
    `Model \`${meta.model}\`, prompt \`${meta.promptVersion}\`, ${summary.cases} cases, ${summary.errors} errors. Gate: **${summary.pass ? "pass" : "fail"}**.`,
    "",
    "| Metric | Result | Threshold | |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    `Reported only: show-me cases that moved the visual ${shown(summary.report.visualActionRate)}, vague questions answered with a clarifying question ${shown(summary.report.clarifyRate)}, mean reply ${shown(summary.report.meanWords)} words.`,
    "",
    "## Misses",
    "",
    ...(misses.length === 0
      ? ["None."]
      : misses.map(
          (record) =>
            `- \`${record.caseId}\` (${record.expect}): ${record.error ?? `${record.turn?.response.kind}${record.entailment ? `, judge ${record.entailment}` : ""}: "${record.turn?.response.text}"`}`,
        )),
  ].join("\n");
}
