import { readFileSync } from "node:fs";
import { createDatabase, createRepositories } from "@sbi/db";
import { createEnv } from "@sbi/env";
import { createDefaultRetriever, ingestTopic } from "@sbi/evidence";
import { z } from "zod";
import { createEvidenceJudge } from "../src/evidence/judge";

// Usage: pnpm --filter @sbi/api ingest:evidence <topic.json> [...more]
const env = createEnv(
  z.object({
    DATABASE_URL: z.url(),
    META_MODEL_API_KEY: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
  }),
  process.env,
);
const files = process.argv.slice(2).filter((arg) => arg !== "--");
if (files.length === 0) {
  console.error("Pass one or more topic files.");
  process.exit(1);
}

const database = createDatabase(env.DATABASE_URL);
const repos = createRepositories(database.db);
try {
  for (const file of files) {
    const report = await ingestTopic(JSON.parse(readFileSync(file, "utf8")), {
      retriever: createDefaultRetriever(),
      judge: createEvidenceJudge(env),
      repositories: { claims: repos.claims, sources: repos.evidenceSources },
      lock: async (task) => {
        const result = await database.withLock("evidence-ingest", task);
        if (!result.acquired) throw new Error("Another evidence ingest is saving; try again.");
        return result.value;
      },
    });
    console.log(JSON.stringify(report, null, 2));
  }
} finally {
  await database.close();
}
