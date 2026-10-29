import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createEnv } from "@sbi/env";
import {
  createDefaultRetriever,
  createMemoryEvidenceRepositories,
  EvidenceSnapshot,
  ingestTopic,
  TopicSources,
} from "@sbi/evidence";
import { SEED_TAXONOMY } from "@sbi/taxonomy";
import { z } from "zod";
import { createEvidenceJudge } from "../src/evidence/judge";

// Usage: pnpm --filter @sbi/api source:facts — sources every taxonomy fact and rewrites the snapshot.
const root = join(import.meta.dirname, "../../../packages/evidence");
const env = createEnv(
  z.object({
    META_MODEL_API_KEY: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
  }),
  process.env,
);
const judge = createEvidenceJudge(env);
const repositories = createMemoryEvidenceRepositories();
const facts: EvidenceSnapshot["facts"] = [];

for (const entry of SEED_TAXONOMY) {
  if (!entry.facts?.length) continue;
  const slug = entry.id.replace(/^object\./, "");
  const sources = TopicSources.parse(
    JSON.parse(readFileSync(join(root, "topics", `${slug}.json`), "utf8")),
  );
  const drafts = entry.facts.map((fact, index) => ({
    key: `${entry.id}#${index + 1}`,
    text: fact.text,
    scope: fact.scope === "category" ? `${entry.label} in general` : `some ${entry.label} models`,
  }));
  const report = await ingestTopic(
    { ...sources, topic: entry.id, drafts },
    { retriever: createDefaultRetriever(), judge, repositories },
  );
  for (const draft of drafts) {
    const claim = report.claims.find((item) => item.key === draft.key);
    const removed = report.removed.find((item) => item.key === draft.key);
    const linked = claim && (claim.status === "supported" || claim.status === "qualified");
    facts.push({
      key: draft.key,
      text: draft.text,
      claimId: linked ? claim.claimId : undefined,
      outcome: claim?.status ?? removed?.reason ?? "unknown",
    });
  }
  console.log(
    `${entry.id}: fetched ${report.fetched.length}, linked ${facts.filter((f) => f.key.startsWith(entry.id) && f.claimId).length}/${drafts.length}`,
  );
}

const claims = await repositories.claims.getMany(facts.flatMap((fact) => fact.claimId ?? []));
const sources = await repositories.sources.getMany([
  ...new Set(claims.flatMap((c) => c.sourceIds)),
]);
const snapshot = EvidenceSnapshot.parse({
  generatedAt: new Date().toISOString(),
  judge: judge.version,
  facts,
  claims,
  sources,
});
writeFileSync(
  join(root, "snapshots/taxonomy-facts.json"),
  `${JSON.stringify(snapshot, null, 2)}\n`,
);
console.log(`linked ${claims.length} of ${facts.length} facts`);
