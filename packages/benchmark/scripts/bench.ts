import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  createProvider,
  loadSeedImage,
  loadSeedSet,
  PROVIDERS,
  rubricCsv,
  runBenchmark,
  summarise,
  summaryMarkdown,
  TASKS,
  type TaskName,
} from "../src";

const envFile = join(import.meta.dirname, "../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const { values } = parseArgs({
  options: {
    providers: { type: "string", default: "meta-spark,openai-mini" },
    tasks: { type: "string", default: TASKS.join(",") },
    model: { type: "string", multiple: true, default: [] },
    limit: { type: "string" },
    concurrency: { type: "string", default: "4" },
    out: { type: "string", default: join(import.meta.dirname, "../../../docs/research/benchmark") },
    "check-models": { type: "boolean", default: false },
  },
});

const overrides = Object.fromEntries(
  values.model.map((pair) => pair.split("=") as [string, string]),
);
const selected = values.providers.split(",").map((id) => {
  const config = PROVIDERS.find((provider) => provider.id === id);
  if (!config) throw new Error(`Unknown provider ${id}; choose from ${PROVIDERS.map((p) => p.id)}`);
  return { config, llm: createProvider(config, process.env, overrides[id]) };
});

if (values["check-models"]) {
  for (const { config, llm } of selected) {
    const response = await fetch(`${config.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${process.env[config.apiKeyEnv]}` },
    });
    const body = (await response.json()) as { data?: { id: string }[] };
    const ids = body.data?.map((model) => model.id) ?? [];
    console.log(`${config.id}: ${ids.includes(llm.model) ? "found" : "MISSING"} ${llm.model}`);
    if (!ids.includes(llm.model)) console.log(`  available: ${ids.join(", ")}`);
  }
  process.exit(0);
}

const set = loadSeedSet();
let done = 0;
const run = await runBenchmark({
  set,
  providers: selected,
  tasks: values.tasks.split(",") as TaskName[],
  loadImage: (prompt) => loadSeedImage(prompt),
  limit: values.limit ? Number(values.limit) : undefined,
  concurrency: Number(values.concurrency),
  onRecord: (record) => {
    done += 1;
    const status = record.ok ? "ok" : `ERROR ${record.error}`;
    console.log(`[${done}] ${record.provider} ${record.task} ${record.promptId} ${status}`);
  },
});

const summary = summarise(run);
const stamp = run.runAt.replace(/[:.]/g, "-").slice(0, 19);
mkdirSync(values.out, { recursive: true });
writeFileSync(
  join(values.out, `${stamp}.json`),
  JSON.stringify({ ...run, summary }, null, 2) + "\n",
);
writeFileSync(join(values.out, `${stamp}.md`), summaryMarkdown(run, summary) + "\n");
writeFileSync(join(values.out, `${stamp}-rubric.csv`), rubricCsv(run));
console.log(summaryMarkdown(run, summary));
