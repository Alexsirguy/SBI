import { and, desc, eq, isNull } from "drizzle-orm";
import type { Database } from "../client";
import { savedLessons } from "../schema";

export interface StoredSavedLesson {
  lessonId: string;
  version: number;
  title: string;
  savedAt: Date;
  sharedAt?: Date | null;
  /** The lesson this one was edited from, when it is the account's own edited copy. */
  editedFrom?: string | null;
}

export interface SavedLessonRepository {
  /** Saving again replaces the pinned version with the one now on screen. */
  save(accountId: string, lesson: StoredSavedLesson): Promise<void>;
  list(accountId: string): Promise<StoredSavedLesson[]>;
  get(accountId: string, lessonId: string): Promise<StoredSavedLesson | undefined>;
  remove(accountId: string, lessonId: string): Promise<void>;
  /** Marks the lesson shared only if it was not yet; false means another request got there first. */
  markShared(
    accountId: string,
    lessonId: string,
    sharedLessonId: string,
    at: Date,
  ): Promise<boolean>;
}

const toSaved = (row: typeof savedLessons.$inferSelect): StoredSavedLesson => ({
  lessonId: row.lessonId,
  savedAt: row.savedAt,
  sharedAt: row.sharedAt,
  editedFrom: row.editedFromLessonId,
  title: row.title,
  version: row.lessonVersion,
});

export function createSavedLessonRepository(db: Database): SavedLessonRepository {
  return {
    async save(accountId, { lessonId, version, title, savedAt, editedFrom }) {
      await db
        .insert(savedLessons)
        .values({
          accountId,
          editedFromLessonId: editedFrom ?? null,
          lessonId,
          lessonVersion: version,
          savedAt,
          title,
        })
        .onDuplicateKeyUpdate({ set: { lessonVersion: version, savedAt, title } });
    },
    async list(accountId) {
      const rows = await db
        .select()
        .from(savedLessons)
        .where(eq(savedLessons.accountId, accountId))
        .orderBy(desc(savedLessons.savedAt));
      return rows.map(toSaved);
    },
    async get(accountId, lessonId) {
      const [row] = await db
        .select()
        .from(savedLessons)
        .where(and(eq(savedLessons.accountId, accountId), eq(savedLessons.lessonId, lessonId)));
      return row ? toSaved(row) : undefined;
    },
    async markShared(accountId, lessonId, sharedLessonId, at) {
      const [header] = (await db
        .update(savedLessons)
        .set({ sharedAt: at, sharedLessonId })
        .where(
          and(
            eq(savedLessons.accountId, accountId),
            eq(savedLessons.lessonId, lessonId),
            isNull(savedLessons.sharedAt),
          ),
        )) as unknown as [{ affectedRows?: number }];
      return (header.affectedRows ?? 0) === 1;
    },
    async remove(accountId, lessonId) {
      await db
        .delete(savedLessons)
        .where(and(eq(savedLessons.accountId, accountId), eq(savedLessons.lessonId, lessonId)));
    },
  };
}
