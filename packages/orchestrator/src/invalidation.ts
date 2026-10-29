import type { EvidenceInvalidated, Lesson } from "@sbi/contracts";
import type { LessonRepository } from "./lesson-repository";

export interface LessonInvalidator {
  /** Marks every lesson built on the invalidated claims as stale; returns how many changed. */
  publish(event: EvidenceInvalidated): Promise<number>;
}

const REASONS: Record<EvidenceInvalidated["reason"], string> = {
  changed: "no longer says what we quoted",
  gone: "is no longer available",
  "rights-changed": "now has stricter reuse terms",
};

// Stale lessons stay readable by id but must not be reused until regenerated and re-validated.
export function createLessonInvalidator(lessons: LessonRepository): LessonInvalidator {
  return {
    async publish(event) {
      if (event.claimIds.length === 0) return 0;
      const affected = await lessons.findByClaimIds(event.claimIds);
      let changed = 0;
      for (const lesson of affected) {
        if (lesson.reuse.sourceFreshness === "stale") continue;
        const stale: Lesson = {
          ...lesson,
          reuse: {
            ...lesson.reuse,
            sourceFreshness: "stale",
            invalidationReason: `Source ${event.sourceId} ${REASONS[event.reason]} (${event.detectedAt.slice(0, 10)}).`,
          },
        };
        await lessons.save(stale);
        changed += 1;
      }
      return changed;
    },
  };
}

/** Whether a stored lesson may be served from cache. */
export function isReusable(lesson: Pick<Lesson, "reuse" | "reviewStatus">): boolean {
  return lesson.reuse.sourceFreshness !== "stale" && lesson.reviewStatus !== "rejected";
}
