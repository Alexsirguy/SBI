import { percentile, rate } from "./match";
import type { BenchmarkRun, RunRecord, TaskName } from "./run";
import type { LessonDraft, LessonScore } from "./tasks/lesson";
import type { RecognitionScore } from "./tasks/recognition";
import type { SafetyScore } from "./tasks/safety";

export interface TaskSummary {
  provider: string;
  task: TaskName;
  runs: number;
  errors: number;
  metrics: Record<string, number | null>;
  latencyP50Ms: number;
  latencyP95Ms: number;
  costUsd: number;
}

function metricsFor(task: TaskName, records: RunRecord[]): Record<string, number | null> {
  if (task === "recognition") {
    const scores = records.map((record) => record.score as RecognitionScore);
    return {
      top1: rate(scores.filter((score) => score.top1).length, scores.length),
      top3: rate(scores.filter((score) => score.top3).length, scores.length),
      statusAccuracy: rate(scores.filter((score) => score.statusCorrect).length, scores.length),
    };
  }
  if (task === "lesson") {
    const scores = records.map((record) => record.score as LessonScore);
    return {
      schemaValid: rate(scores.filter((score) => score.schemaValid).length, scores.length),
      allEightModules: rate(
        scores.filter((score) => score.modulesCovered === 8).length,
        scores.length,
      ),
      citationsResolve: rate(scores.filter((score) => score.allSourcesCited).length, scores.length),
    };
  }
  const scores = records.map((record) => record.score as SafetyScore);
  const risky = scores.filter((score) => !score.expectedAllow);
  const benign = scores.filter((score) => score.expectedAllow);
  return {
    exact: rate(scores.filter((score) => score.exact).length, scores.length),
    riskyHandledSafely: rate(risky.filter((score) => score.safe).length, risky.length),
    overRefusal: rate(benign.filter((score) => score.overRefusal).length, benign.length),
  };
}

/** Aggregates per-provider, per-task metrics from a run. */
export function summarise(run: BenchmarkRun): TaskSummary[] {
  const groups = new Map<string, RunRecord[]>();
  for (const record of run.records) {
    const key = `${record.provider}|${record.task}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups.entries()].map(([key, records]) => {
    const [provider = "", task] = key.split("|") as [string, TaskName];
    const ok = records.filter((record) => record.ok);
    const latencies = ok.map((record) => record.latencyMs);
    return {
      provider,
      task,
      runs: records.length,
      errors: records.length - ok.length,
      metrics: metricsFor(task, ok),
      latencyP50Ms: percentile(latencies, 50),
      latencyP95Ms: percentile(latencies, 95),
      costUsd: Math.round(records.reduce((sum, record) => sum + record.costUsd, 0) * 10000) / 10000,
    };
  });
}

const pct = (value: number | null | undefined) =>
  value === null || value === undefined ? "–" : `${Math.round(value * 100)}%`;

export function summaryMarkdown(run: BenchmarkRun, summary: TaskSummary[]): string {
  const providers = run.providers.map((provider) => `\`${provider.id}\` (${provider.model})`);
  const lines = [
    `# Vendor benchmark ${run.runAt.slice(0, 10)}`,
    "",
    `Seed set ${run.seedVersion}; prompts ${Object.values(run.promptVersions).join(", ")}; providers ${providers.join(", ")}.`,
    "",
  ];
  const table = (task: TaskName, columns: [string, string][]) => {
    lines.push(`## ${task[0]?.toUpperCase()}${task.slice(1)}`, "");
    lines.push(
      `| Provider | Runs | Errors | ${columns.map(([, label]) => label).join(" | ")} | p50 ms | p95 ms | Cost USD |`,
      `| --- | --- | --- | ${columns.map(() => "---").join(" | ")} | --- | --- | --- |`,
    );
    for (const row of summary.filter((item) => item.task === task)) {
      const cells = columns.map(([key]) => pct(row.metrics[key]));
      lines.push(
        `| ${row.provider} | ${row.runs} | ${row.errors} | ${cells.join(" | ")} | ${row.latencyP50Ms} | ${row.latencyP95Ms} | ${row.costUsd.toFixed(4)} |`,
      );
    }
    lines.push("");
  };
  table("recognition", [
    ["top1", "Top-1"],
    ["top3", "Top-3"],
    ["statusAccuracy", "Status correct"],
  ]);
  table("lesson", [
    ["schemaValid", "Lesson contract valid"],
    ["allEightModules", "All 8 modules"],
    ["citationsResolve", "Citations resolve"],
  ]);
  table("safety", [
    ["exact", "Exact"],
    ["riskyHandledSafely", "Risky handled safely"],
    ["overRefusal", "Over-refusal"],
  ]);
  return lines.join("\n");
}

const csvCell = (value: string) => `"${value.replace(/"/g, '""').replace(/\s+/g, " ")}"`;

/** One row per generated lesson for human scoring of accuracy and age fit. */
export function rubricCsv(run: BenchmarkRun): string {
  const header =
    "prompt_id,provider,title,short_answer,accuracy_1_5,age_fit_1_5,misconception_handled_y_n,notes";
  const rows = run.records
    .filter((record) => record.task === "lesson" && record.ok)
    .map((record) => {
      const draft = record.output as LessonDraft;
      const short = draft.sections.find((section) => section.module === "short-answer")?.text ?? "";
      return [
        record.promptId,
        record.provider,
        csvCell(draft.title),
        csvCell(short),
        "",
        "",
        "",
        "",
      ].join(",");
    });
  return [header, ...rows].join("\n") + "\n";
}
