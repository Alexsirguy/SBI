import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  createOpenAiCompatibleProvider,
  META_MODEL_API_BASE_URL,
  OPENAI_BASE_URL,
  type LlmProvider,
} from "@sbi/llm";
import { gate, loadBenchmarkSet, reportMarkdown, runBenchmark, summarise } from "../src/eval";

const root = join(import.meta.dirname, "../../..");
// The API's own settings, so the judge is the model the pipeline's checks use.
for (const file of [join(import.meta.dirname, "../.env"), join(root, "apps/api/.env")]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const { values } = parseArgs({
  options: {
    set: { type: "string", default: "v1" },
    api: { type: "string", default: process.env.BENCHMARK_API_URL ?? "http://localhost:4100" },
    limit: { type: "string" },
    concurrency: { type: "string", default: "3" },
    out: { type: "string", default: join(root, "docs/research/lesson-eval/results") },
  },
});

function judge(): LlmProvider {
  const { META_MODEL_API_KEY, OPENAI_API_KEY, LESSON_MODEL } = process.env;
  if (!LESSON_MODEL) throw new Error("Set LESSON_MODEL and a model API key (see apps/api/.env).");
  if (META_MODEL_API_KEY) {
    return createOpenAiCompatibleProvider({
      id: "lesson-eval-meta",
      baseUrl: META_MODEL_API_BASE_URL,
      apiKey: META_MODEL_API_KEY,
      model: LESSON_MODEL,
      extraBody: { reasoning_effort: "low" },
      timeoutMs: 90_000,
    });
  }
  if (!OPENAI_API_KEY) throw new Error("Set META_MODEL_API_KEY or OPENAI_API_KEY.");
  return createOpenAiCompatibleProvider({
    id: "lesson-eval-openai",
    baseUrl: OPENAI_BASE_URL,
    apiKey: OPENAI_API_KEY,
    model: LESSON_MODEL,
    maxTokensParam: "max_completion_tokens",
    // ADR 0006: OpenAI must not keep what we send it.
    extraBody: { reasoning_effort: "low", store: false },
    timeoutMs: 90_000,
  });
}

const set = loadBenchmarkSet(join(root, "docs/research"), values.set);
const limited = values.limit ? { ...set, cases: set.cases.slice(0, Number(values.limit)) } : set;
let done = 0;
const records = await runBenchmark(
  {
    judge: judge(),
    apiUrl: values.api,
    concurrency: Number(values.concurrency),
    onRecord: (record) => {
      done += 1;
      console.log(
        `[${done}/${limited.cases.length}] ${record.promptId} ${record.expectedSafety} → ${record.error ?? record.outcome}`,
      );
    },
  },
  limited,
);

const summary = summarise(records);
const runAt = new Date().toISOString();
const meta = {
  runAt,
  set: set.version,
  seedSet: set.seedSet,
  apiUrl: values.api,
  judge: process.env.LESSON_MODEL ?? "unknown",
};
mkdirSync(values.out, { recursive: true });
const stamp = runAt.slice(0, 19).replaceAll(":", "-");
writeFileSync(
  join(values.out, `${stamp}.json`),
  `${JSON.stringify({ meta, summary, records }, null, 2)}\n`,
);
writeFileSync(join(values.out, `${stamp}.md`), reportMarkdown(meta, summary, records));
console.log(JSON.stringify(summary, null, 2));
const passed = summary.errors === 0 && gate(summary).every((row) => row.passed);
console.log(`Gate: ${passed ? "pass" : "fail"} (${join(values.out, `${stamp}.md`)})`);
process.exitCode = passed ? 0 : 1;
