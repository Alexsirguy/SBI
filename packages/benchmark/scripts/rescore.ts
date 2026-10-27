import { readFileSync, writeFileSync } from "node:fs";
import type { RecognitionOutcome } from "@sbi/recognition";
import {
  loadSeedSet,
  rubricCsv,
  scoreRecognition,
  summarise,
  summaryMarkdown,
  type BenchmarkRun,
} from "../src";

// Re-applies the current recognition scoring to stored outputs, so scorer fixes need no new API calls.
const path = process.argv[2];
if (!path?.endsWith(".json")) throw new Error("Usage: rescore <run>.json");
const run = JSON.parse(readFileSync(path, "utf8")) as BenchmarkRun & { rescoredAt?: string };
const prompts = new Map(loadSeedSet().prompts.map((prompt) => [prompt.id, prompt]));

for (const record of run.records) {
  const prompt = prompts.get(record.promptId);
  if (record.task !== "recognition" || !record.ok || !prompt) continue;
  record.score = scoreRecognition(prompt, record.output as RecognitionOutcome);
}
run.rescoredAt = new Date().toISOString();
const summary = summarise(run);
writeFileSync(path, JSON.stringify({ ...run, summary }, null, 2) + "\n");
writeFileSync(path.replace(/\.json$/, ".md"), summaryMarkdown(run, summary) + "\n");
writeFileSync(path.replace(/\.json$/, "-rubric.csv"), rubricCsv(run));
console.log(summaryMarkdown(run, summary));
