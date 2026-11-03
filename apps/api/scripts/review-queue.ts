import { createDatabase, createRepositories } from "@sbi/db";
import { createEnv } from "@sbi/env";
import { z } from "zod";

// Usage: pnpm --filter @sbi/api ops:review-queue — lesson versions by review status (#110).
const env = createEnv(z.object({ DATABASE_URL: z.url() }), process.env);
const handle = createDatabase(env.DATABASE_URL);
try {
  const queue = await createRepositories(handle.db).coverage.reviewQueue();
  for (const row of queue.sort((a, b) => b.versions - a.versions)) {
    console.log(`${row.status}: ${row.versions}`);
  }
} finally {
  await handle.close();
}
