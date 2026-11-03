import { createDatabase, createRepositories } from "@sbi/db";
import { createEnv } from "@sbi/env";
import { createTaxonomy, prioritiseDemand, SEED_TAXONOMY } from "@sbi/taxonomy";
import { z } from "zod";

// Usage: pnpm --filter @sbi/api catalog:priorities — what to add to the catalogue next, by demand.
const env = createEnv(z.object({ DATABASE_URL: z.url() }), process.env);
const handle = createDatabase(env.DATABASE_URL);
try {
  const repos = createRepositories(handle.db);
  const [gaps, taught] = await Promise.all([
    repos.catalogGaps.top(500),
    repos.coverage.taughtBySubject(),
  ]);
  const onDemand = taught
    .filter((item) => item.taxonomyId.startsWith("subject."))
    .map((item) => ({ count: item.lessons, subject: item.taxonomyId.slice("subject.".length) }));
  const priorities = prioritiseDemand(gaps, onDemand, createTaxonomy(SEED_TAXONOMY));
  for (const [index, item] of priorities.entries()) {
    console.log(`${index + 1}. ${item.term} (${item.demand}): ${item.terms.join(", ")}`);
  }
} finally {
  await handle.close();
}
