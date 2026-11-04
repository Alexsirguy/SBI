import { count, countDistinct, sql } from "drizzle-orm";
import type { Database } from "../client";
import { lessons } from "../schema";

export interface CoverageRepository {
  /** Distinct lessons per subject taught so far, catalogue ids and on-demand subjects alike. */
  taughtBySubject(): Promise<{ taxonomyId: string; lessons: number }[]>;
  /** Lesson versions per review status, for sizing the review queue (#110). */
  reviewQueue(): Promise<{ status: string; versions: number }[]>;
  /** Approved and auto-validated versions, for drawing an expert-review sample (#80). */
  reviewCandidates(): Promise<
    {
      lessonId: string;
      version: number;
      taxonomyId: string;
      safetyClass: string;
      reuseCount: number;
    }[]
  >;
}

export function createCoverageRepository(db: Database): CoverageRepository {
  return {
    async taughtBySubject() {
      return db
        .select({ lessons: countDistinct(lessons.lessonId), taxonomyId: lessons.taxonomyId })
        .from(lessons)
        .groupBy(lessons.taxonomyId);
    },
    async reviewQueue() {
      return db
        .select({ status: lessons.reviewStatus, versions: count() })
        .from(lessons)
        .groupBy(lessons.reviewStatus);
    },
    async reviewCandidates() {
      const rows = await db
        .select({
          lessonId: lessons.lessonId,
          version: lessons.version,
          taxonomyId: lessons.taxonomyId,
          safetyClass: lessons.safetyClass,
          reviewStatus: lessons.reviewStatus,
          reuseCount: sql<number>`COALESCE(JSON_VALUE(${lessons.document}, '$.reuse.reuseCount'), 0)`,
        })
        .from(lessons);
      // Only what learners can be served; drafts and rejected versions never reach anyone.
      return rows
        .filter((row) => row.reviewStatus === "approved" || row.reviewStatus === "auto-validated")
        .map(({ reviewStatus: _status, ...row }) => ({
          ...row,
          reuseCount: Number(row.reuseCount),
        }));
    },
  };
}
