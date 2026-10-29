import { newId } from "@sbi/contracts";
import type { PublishAudit, ReviewAuditLog, ReviewStatus } from "@sbi/orchestrator";
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../client";
import { lessonReviewEvents } from "../schema";

export function createReviewAuditLog(db: Database): ReviewAuditLog {
  return {
    async record(audit) {
      await db.insert(lessonReviewEvents).values({
        eventId: newId(),
        lessonId: audit.lessonId,
        version: audit.version,
        fromStatus: audit.from,
        toStatus: audit.to,
        reviewedBy: audit.by,
        at: new Date(audit.at),
        reason: audit.reason?.slice(0, 2000) ?? null,
      });
    },
    async history(lessonId, version) {
      const rows = await db
        .select()
        .from(lessonReviewEvents)
        .where(
          version === undefined
            ? eq(lessonReviewEvents.lessonId, lessonId)
            : and(
                eq(lessonReviewEvents.lessonId, lessonId),
                eq(lessonReviewEvents.version, version),
              ),
        )
        .orderBy(asc(lessonReviewEvents.at));
      return rows.map((row): PublishAudit => ({
        lessonId: row.lessonId,
        version: row.version,
        from: row.fromStatus as ReviewStatus,
        to: row.toStatus as ReviewStatus,
        by: row.reviewedBy,
        at: row.at.toISOString(),
        ...(row.reason ? { reason: row.reason } : {}),
      }));
    },
  };
}
