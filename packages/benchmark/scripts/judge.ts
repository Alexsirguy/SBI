import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  createProvider,
  GUESS_JUDGE_PROMPT_VERSION,
  judgeGuesses,
  PROVIDERS,
  rubricCsv,
  summarise,
  summaryMarkdown,
  type BenchmarkRun,
  type LessonDraft,
} from "../src";

const envFile = join(import.meta.dirname, "../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

// A different vendor from the primary judges, so a model doesn't mark its own work.
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { judge: { type: "string", default: "openai-mini" } },
});
const path = positionals[0];
if (!path?.endsWith(".json")) throw new Error("Usage: judge <run>.json [--judge openai-mini]");
const config = PROVIDERS.find((provider) => provider.id === values.judge);
if (!config) throw new Error(`Unknown judge ${values.judge}`);
const llm = createProvider(config, process.env);

const run = JSON.parse(readFileSync(path, "utf8")) as BenchmarkRun;
// Re-running fills in failed judgements; a new judge prompt version judges everything again.
const fresh = run.judgedWith?.promptVersion !== GUESS_JUDGE_PROMPT_VERSION;
const lessons = run.records.filter(
  (record) => record.task === "lesson" && record.ok && (fresh || !record.judge),
);
if (fresh) for (const record of run.records) delete record.judge;
let done = 0;
const queue = [...lessons];
const worker = async () => {
  for (let record = queue.shift(); record; record = queue.shift()) {
    try {
      record.judge = await judgeGuesses(llm, record.output as LessonDraft);
    } catch (error) {
      console.log(`${record.provider} ${record.promptId} judge failed: ${String(error)}`);
    }
    done += 1;
    const problems = record.judge?.problems ?? [];
    console.log(
      `[${done}/${lessons.length}] ${record.provider} ${record.promptId} ${problems.length} misfit`,
    );
    for (const problem of problems) console.log(`    ${problem.question} — ${problem.problem}`);
  }
};
await Promise.all(Array.from({ length: 4 }, worker));
run.judgedWith = {
  provider: config.id,
  model: llm.model,
  promptVersion: GUESS_JUDGE_PROMPT_VERSION,
};
const summary = summarise(run);
writeFileSync(path, JSON.stringify({ ...run, summary }, null, 2) + "\n");
writeFileSync(path.replace(/\.json$/, ".md"), summaryMarkdown(run, summary) + "\n");
writeFileSync(path.replace(/\.json$/, "-rubric.csv"), rubricCsv(run));
console.log(summaryMarkdown(run, summary));
