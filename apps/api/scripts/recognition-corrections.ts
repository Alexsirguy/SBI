import { createDatabase, createRepositories } from "@sbi/db";
import { createEnv } from "@sbi/env";
import { correctionRate } from "@sbi/recognition/eval";
import { z } from "zod";

// Usage: pnpm --filter @sbi/api ops:recognition-corrections [days] — how often learners corrected
// recognition (#79). Results are kept 30 days, so that is the longest window there is.
const days = Number(process.argv[2] ?? 30);
const env = createEnv(z.object({ DATABASE_URL: z.url() }), process.env);
const handle = createDatabase(env.DATABASE_URL);
try {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const results = await createRepositories(handle.db).recognitionResults.listSince(since);
  console.log(JSON.stringify({ since: since.toISOString(), ...correctionRate(results) }, null, 2));
} finally {
  await handle.close();
}
