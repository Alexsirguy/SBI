import { createDatabase, createRepositories } from "@sbi/db";
import { createEnv } from "@sbi/env";
import { RUBRIC_VERSION, sampleForReview, type SampleCandidate } from "@sbi/evidence";
import { z } from "zod";

// Usage: pnpm --filter @sbi/api ops:quality-sample [size] [seed] — lessons for expert review (#80),
// as CSV rows for docs/research/quality-review/review-sheet.csv. Keep the seed to redraw it.
const size = Number(process.argv[2] ?? 30);
const seed = Number(process.argv[3] ?? Date.now() % 100_000);
const env = createEnv(z.object({ DATABASE_URL: z.url() }), process.env);
const handle = createDatabase(env.DATABASE_URL);
try {
  const candidates = (await createRepositories(handle.db).coverage.reviewCandidates()).map(
    (row): SampleCandidate => ({
      ...row,
      safetyClass:
        row.safetyClass === "high" || row.safetyClass === "medium" ? row.safetyClass : "low",
    }),
  );
  const sample = sampleForReview(candidates, { size, seed });
  console.log(
    `# ${RUBRIC_VERSION}, seed ${seed}, ${sample.length} of ${candidates.length} versions`,
  );
  console.log("lessonId,version,taxonomyId,safetyClass,reuseCount");
  for (const row of sample) {
    console.log(
      [row.lessonId, row.version, row.taxonomyId, row.safetyClass, row.reuseCount].join(","),
    );
  }
} finally {
  await handle.close();
}
