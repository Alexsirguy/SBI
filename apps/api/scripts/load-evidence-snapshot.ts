import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDatabase, createRepositories } from "@sbi/db";
import { createEnv } from "@sbi/env";
import { EvidenceSnapshot, loadSnapshot } from "@sbi/evidence";
import { z } from "zod";

// Usage: pnpm --filter @sbi/api load:evidence — stores the committed taxonomy-fact claims.
const env = createEnv(z.object({ DATABASE_URL: z.url() }), process.env);
const file = join(import.meta.dirname, "../../../packages/evidence/snapshots/taxonomy-facts.json");
const snapshot = EvidenceSnapshot.parse(JSON.parse(readFileSync(file, "utf8")));
const database = createDatabase(env.DATABASE_URL);
try {
  const repos = createRepositories(database.db);
  await loadSnapshot(snapshot, { claims: repos.claims, sources: repos.evidenceSources });
  console.log(`Loaded ${snapshot.claims.length} claims and ${snapshot.sources.length} sources.`);
} finally {
  await database.close();
}
