import type { DatabaseHandle, LockResult, Repositories } from "@sbi/db";
import type { LessonRepository } from "@sbi/orchestrator";
import { runFreshnessPass, type FreshnessPassResult, type Retriever } from "@sbi/evidence";
import { createLessonInvalidator } from "@sbi/orchestrator";

export interface FreshnessPassSummary extends FreshnessPassResult {
  lessonsMarkedStale: number;
}

export type FreshnessPass = () => Promise<LockResult<FreshnessPassSummary>>;

export interface FreshnessPassDeps {
  database: Pick<DatabaseHandle, "withLock">;
  // Narrower than Repositories["lessons"]: invalidation needs no category lookup.
  repositories: Pick<Repositories, "claims" | "evidenceSources"> & { lessons: LessonRepository };
  retriever: Retriever;
  maxAgeDays: number;
  batch: number;
  now?: () => Date;
}

/** Re-checks due sources and marks lessons built on invalidated claims as stale. */
export function createFreshnessPass(deps: FreshnessPassDeps): FreshnessPass {
  const invalidator = createLessonInvalidator(deps.repositories.lessons);
  return () =>
    deps.database.withLock("evidence-freshness", async () => {
      let lessonsMarkedStale = 0;
      const result = await runFreshnessPass({
        repositories: {
          claims: deps.repositories.claims,
          sources: deps.repositories.evidenceSources,
        },
        retriever: deps.retriever,
        sink: {
          publish: async (event) => {
            lessonsMarkedStale += await invalidator.publish(event);
          },
        },
        now: deps.now?.() ?? new Date(),
        maxAgeDays: deps.maxAgeDays,
        limit: deps.batch,
      });
      return { ...result, lessonsMarkedStale };
    });
}
