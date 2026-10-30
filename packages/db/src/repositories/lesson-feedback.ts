import { type LessonFeedbackRequest, newId } from "@sbi/contracts";
import { and, asc, eq, isNotNull, lt } from "drizzle-orm";
import type { Database } from "../client";
import { lessonFeedback } from "../schema";

export interface StoredLessonFeedback extends LessonFeedbackRequest {
  feedbackId: string;
  receivedAt: string;
}

export interface LessonFeedbackRepository {
  record(feedback: LessonFeedbackRequest, at: Date): Promise<StoredLessonFeedback>;
  /** Oldest first, for triage of one lesson or one of its versions. */
  forLesson(lessonId: string, version?: number): Promise<StoredLessonFeedback[]>;
  /** Clears free text received before `cutoff`, keeping category and rating; returns rows cleared. */
  clearDetailsBefore(cutoff: Date): Promise<number>;
}

export function createLessonFeedbackRepository(db: Database): LessonFeedbackRepository {
  return {
    async record(feedback, at) {
      const feedbackId = newId();
      await db.insert(lessonFeedback).values({
        feedbackId,
        lessonId: feedback.lessonId,
        version: feedback.version,
        category: feedback.report?.category ?? null,
        details: feedback.report?.details ?? null,
        helpful: feedback.rating?.helpful ?? null,
        clear: feedback.rating?.clear ?? null,
        createdAt: at,
      });
      return { ...feedback, feedbackId, receivedAt: at.toISOString() };
    },
    async clearDetailsBefore(cutoff) {
      const [result] = await db
        .update(lessonFeedback)
        .set({ details: null })
        .where(and(lt(lessonFeedback.createdAt, cutoff), isNotNull(lessonFeedback.details)));
      return result.affectedRows;
    },
    async forLesson(lessonId, version) {
      const rows = await db
        .select()
        .from(lessonFeedback)
        .where(
          version === undefined
            ? eq(lessonFeedback.lessonId, lessonId)
            : and(eq(lessonFeedback.lessonId, lessonId), eq(lessonFeedback.version, version)),
        )
        .orderBy(asc(lessonFeedback.createdAt));
      return rows.map((row) => ({
        feedbackId: row.feedbackId,
        lessonId: row.lessonId,
        version: row.version,
        receivedAt: row.createdAt.toISOString(),
        ...(row.category
          ? {
              report: {
                category: row.category as NonNullable<LessonFeedbackRequest["report"]>["category"],
                ...(row.details ? { details: row.details } : {}),
              },
            }
          : {}),
        ...(row.helpful !== null && row.clear !== null
          ? { rating: { helpful: row.helpful, clear: row.clear } }
          : {}),
      }));
    },
  };
}
