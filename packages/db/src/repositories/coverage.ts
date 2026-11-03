import { countDistinct } from "drizzle-orm";
import type { Database } from "../client";
import { lessons } from "../schema";

export interface CoverageRepository {
  /** Distinct lessons per subject taught so far, catalogue ids and on-demand subjects alike. */
  taughtBySubject(): Promise<{ taxonomyId: string; lessons: number }[]>;
}

export function createCoverageRepository(db: Database): CoverageRepository {
  return {
    async taughtBySubject() {
      return db
        .select({ lessons: countDistinct(lessons.lessonId), taxonomyId: lessons.taxonomyId })
        .from(lessons)
        .groupBy(lessons.taxonomyId);
    },
  };
}
