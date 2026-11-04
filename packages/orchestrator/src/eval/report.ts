import { gate, THRESHOLDS, type CaseRecord, type Summary } from "./score";

const percent = (value: number) => `${Math.round(value * 100)}%`;

/** The Markdown kept next to the thresholds, so each run can be compared with the last. */
export function reportMarkdown(
  meta: { runAt: string; set: string; seedSet: string; apiUrl: string; judge: string },
  summary: Summary,
  records: CaseRecord[],
): string {
  const rows = gate(summary).map(({ metric, value, passed }) => {
    const limit = THRESHOLDS[metric as keyof typeof THRESHOLDS];
    const target = "min" in limit ? `≥ ${limit.min}` : `≤ ${limit.max}`;
    const shown = Number.isInteger(value) ? String(value) : value.toFixed(2);
    return `| ${metric} | ${shown} | ${target} | ${passed ? "pass" : "**fail**"} |`;
  });
  const passed = summary.errors === 0 && gate(summary).every((row) => row.passed);
  const misses = records.flatMap((record) => [
    ...(record.safetyCorrect
      ? []
      : [`- ${record.promptId}: expected ${record.expectedSafety}, got ${record.outcome}`]),
    ...(record.error ? [`- ${record.promptId}: error ${record.error}`] : []),
    ...(record.keyFacts ?? [])
      .filter((fact) => fact.verdict !== "supports")
      .map(
        (fact) => `- ${record.promptId}: key fact ${fact.verdict}: "${fact.fact}" (${fact.reason})`,
      ),
    ...(record.misconceptions ?? [])
      .filter((item) => item.asserted)
      .map((item) => `- ${record.promptId}: asserts the misconception "${item.text}"`),
    ...(record.entailment?.failures ?? []).map(
      (reason) => `- ${record.promptId}: section ${reason}`,
    ),
    ...(record.reading && !record.reading.passed
      ? [
          `- ${record.promptId}: reading ease ${record.reading.ease} below the ${record.reading.level} floor`,
        ]
      : []),
    ...(record.unsafeActivities ?? []).map(
      (detail) => `- ${record.promptId}: unsafe activity ${detail}`,
    ),
  ]);
  return [
    `# Lesson benchmark ${meta.runAt}`,
    "",
    `Set ${meta.set} over seed set ${meta.seedSet}; ${summary.cases} prompts, ${summary.errors} errors; API ${meta.apiUrl}; judge ${meta.judge}.`,
    `Median time to a full lesson: ${summary.medianSeconds} s. Key-fact coverage ${percent(summary.keyFactCoverage)}.`,
    "",
    `**Gate: ${passed ? "pass" : "fail"}**`,
    "",
    "| Metric | Result | Gate | |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    "## Misses",
    "",
    ...(misses.length > 0 ? misses : ["None."]),
    "",
  ].join("\n");
}
