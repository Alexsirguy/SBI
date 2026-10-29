import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  auditRights,
  CacheFixture,
  classifySafety,
  createProvider,
  evaluateCache,
  evaluateRules,
  EvidenceFixture,
  keywordClassifier,
  llmClassifier,
  loadSeedSet,
  PROVIDERS,
  runEvidenceSpike,
  safeClassifier,
  scoreSafety,
  trustedSourceFinder,
} from "../src";
import { createDefaultRetriever } from "@sbi/evidence";

const envFile = join(import.meta.dirname, "../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const dir = join(import.meta.dirname, "../../../docs/research/spikes");
const { values } = parseArgs({ options: { llm: { type: "string" } } });
const readJson = (file: string) => JSON.parse(readFileSync(join(dir, file), "utf8"));

const set = loadSeedSet();
const cacheFixture = CacheFixture.parse(readJson("cache-pairs.json"));
const evidenceFixture = EvidenceFixture.parse(readJson("evidence-claims.json"));

const results: Record<string, unknown> = {
  runAt: new Date().toISOString(),
  seedVersion: set.version,
  cache: { keyword: await evaluateCache(cacheFixture, keywordClassifier(cacheFixture.catalog)) },
  safety: { rules: evaluateRules(set.prompts) },
  evidence: await runEvidenceSpike(
    evidenceFixture,
    trustedSourceFinder(createDefaultRetriever({ retryDelayMs: 2000 })),
  ),
  rights: auditRights(set),
};

if (values.llm) {
  const config = PROVIDERS.find((provider) => provider.id === values.llm);
  if (!config) throw new Error(`Unknown provider ${values.llm}`);
  const llm = createProvider(config, process.env);
  const cacheErrors: string[] = [];
  (results.cache as Record<string, unknown>).llm = {
    provider: config.id,
    ...(await evaluateCache(
      cacheFixture,
      safeClassifier(llmClassifier(llm, cacheFixture.catalog), cacheErrors),
    )),
    errors: cacheErrors,
  };
  const scores = [];
  for (const prompt of set.prompts) {
    try {
      const { decision } = await classifySafety(llm, prompt);
      scores.push({ id: prompt.id, decision: decision.decision, ...scoreSafety(prompt, decision) });
    } catch (error) {
      scores.push({ id: prompt.id, error: String(error).slice(0, 200) });
    }
  }
  (results.safety as Record<string, unknown>).llm = {
    provider: config.id,
    model: llm.model,
    scores,
  };
}

const stamp = String(results.runAt).replace(/[:.]/g, "-").slice(0, 19);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `${stamp}.json`), JSON.stringify(results, null, 2) + "\n");
console.log(JSON.stringify(results, null, 2));
