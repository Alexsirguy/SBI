import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  createOpenAiCompatibleProvider,
  META_MODEL_API_BASE_URL,
  OPENAI_BASE_URL,
  type LlmProvider,
} from "@sbi/llm";
import { judgeEntailment } from "@sbi/orchestrator";
import { createRiskClassifier } from "@sbi/safety";
import { TUTOR_ANSWER_PROMPT_VERSION } from "../src";
import { loadEvalSet, reportMarkdown, runTutorEval, summarise } from "../src/eval";

const root = join(import.meta.dirname, "../../..");
// The API's own settings, so the eval measures the model learners would get.
for (const file of [join(import.meta.dirname, "../.env"), join(root, "apps/api/.env")]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const { values } = parseArgs({
  options: {
    set: { type: "string", default: "v1" },
    limit: { type: "string" },
    concurrency: { type: "string", default: "4" },
    out: { type: "string", default: join(root, "docs/research/tutor-eval/results") },
  },
});

function provider(): LlmProvider {
  const { META_MODEL_API_KEY, OPENAI_API_KEY, LESSON_MODEL } = process.env;
  if (!LESSON_MODEL) throw new Error("Set LESSON_MODEL and a model API key (see apps/api/.env).");
  if (META_MODEL_API_KEY) {
    return createOpenAiCompatibleProvider({
      id: "tutor-eval-meta",
      baseUrl: META_MODEL_API_BASE_URL,
      apiKey: META_MODEL_API_KEY,
      model: LESSON_MODEL,
      extraBody: { reasoning_effort: "low" },
      timeoutMs: 60_000,
    });
  }
  if (!OPENAI_API_KEY) throw new Error("Set META_MODEL_API_KEY or OPENAI_API_KEY.");
  return createOpenAiCompatibleProvider({
    id: "tutor-eval-openai",
    baseUrl: OPENAI_BASE_URL,
    apiKey: OPENAI_API_KEY,
    model: LESSON_MODEL,
    maxTokensParam: "max_completion_tokens",
    // ADR 0006: OpenAI must not keep what we send it.
    extraBody: { reasoning_effort: "low", store: false },
    timeoutMs: 60_000,
  });
}

const llm = provider();
const set = loadEvalSet(join(root, "docs/research/tutor-eval"), values.set);
const limited = values.limit ? { ...set, cases: set.cases.slice(0, Number(values.limit)) } : set;
let done = 0;
const records = await runTutorEval(
  {
    provider: llm,
    classify: createRiskClassifier({ provider: llm, timeoutMs: 30_000 }),
    judge: async (text, cited) => (await judgeEntailment(llm, text, cited)).verdict,
    concurrency: Number(values.concurrency),
    onRecord: (record) => {
      done += 1;
      const outcome = record.error ?? record.turn?.response.kind;
      console.log(
        `[${done}/${limited.cases.length}] ${record.caseId} ${record.expect} → ${outcome}`,
      );
    },
  },
  limited,
);

const summary = summarise(records);
const runAt = new Date().toISOString();
const meta = {
  version: set.version,
  model: llm.model,
  promptVersion: TUTOR_ANSWER_PROMPT_VERSION,
  runAt,
};
const stamp = runAt.replace(/[:.]/g, "-").slice(0, 19);
mkdirSync(values.out, { recursive: true });
writeFileSync(
  join(values.out, `${stamp}.json`),
  JSON.stringify({ ...meta, summary, records }, null, 2) + "\n",
);
const report = reportMarkdown(meta, summary, records);
writeFileSync(join(values.out, `${stamp}.md`), report + "\n");
console.log(report);
process.exitCode = summary.pass ? 0 : 1;
