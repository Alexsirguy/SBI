import { and, asc, eq, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";
import type { Database } from "../client";
import { classActivity, classes, classLessons, educators } from "../schema";

export interface StoredClassControls {
  audienceLock: string | null;
  blockedCategories: string[];
  tutorEnabled: boolean;
}

export interface StoredClassLesson {
  lessonId: string;
  version: number;
  title: string;
  addedAt: Date;
}

export interface StoredClass {
  classId: string;
  ownerAccountId: string;
  name: string;
  joinCodeHint: string;
  curriculum: string | null;
  level: string | null;
  controls: StoredClassControls;
  createdAt: Date;
  archivedAt: Date | null;
  lessons: StoredClassLesson[];
}

export interface StoredClassActivity {
  week: string;
  metric: string;
  count: number;
}

export type NewClass = Omit<StoredClass, "lessons" | "archivedAt"> & { joinCodeHash: string };
export type ClassChanges = Partial<
  Pick<StoredClass, "name" | "curriculum" | "level" | "controls" | "archivedAt">
>;

export interface ClassRepository {
  isEducator(accountId: string): Promise<boolean>;
  enableEducator(accountId: string, at: Date): Promise<void>;
  create(input: NewClass): Promise<void>;
  /** Classes the account owns, archived ones included, oldest first. */
  listOwned(accountId: string): Promise<StoredClass[]>;
  getOwned(accountId: string, classId: string): Promise<StoredClass | undefined>;
  /** An open (not archived) class by its join-code hash, for learners. */
  findOpenByCode(joinCodeHash: string): Promise<StoredClass | undefined>;
  update(classId: string, changes: ClassChanges): Promise<void>;
  setJoinCode(classId: string, joinCodeHash: string, joinCodeHint: string): Promise<void>;
  addLesson(classId: string, lesson: StoredClassLesson): Promise<void>;
  removeLesson(classId: string, lessonId: string): Promise<void>;
  /** In every class the account owns, puts `to` where `fromLessonId` was; returns how many. */
  swapLesson(accountId: string, fromLessonId: string, to: StoredClassLesson): Promise<number>;
  /** Deletes classes archived on or before `before`, with their lessons; returns how many. */
  deleteArchivedBefore(before: Date): Promise<number>;
  /** Adds one to a class's count for a week; there is nothing to say who. */
  recordActivity(classId: string, week: string, metric: string): Promise<void>;
  activity(classId: string): Promise<StoredClassActivity[]>;
  /** Deletes counts for ISO weeks before `week`; returns how many rows. */
  deleteActivityBefore(week: string): Promise<number>;
}

type ClassRow = typeof classes.$inferSelect;

function toClass(row: ClassRow, lessons: StoredClassLesson[]): StoredClass {
  return {
    archivedAt: row.archivedAt,
    classId: row.classId,
    controls: {
      audienceLock: row.audienceLock,
      blockedCategories: (row.blockedCategories as string[] | null) ?? [],
      tutorEnabled: row.tutorEnabled,
    },
    createdAt: row.createdAt,
    curriculum: row.curriculum,
    joinCodeHint: row.joinCodeHint,
    lessons,
    level: row.level,
    name: row.name,
    ownerAccountId: row.ownerAccountId,
  };
}

export function createClassRepository(db: Database): ClassRepository {
  async function withLessons(rows: ClassRow[]): Promise<StoredClass[]> {
    if (rows.length === 0) return [];
    const lessonRows = await db
      .select()
      .from(classLessons)
      .where(
        inArray(
          classLessons.classId,
          rows.map((row) => row.classId),
        ),
      )
      .orderBy(asc(classLessons.addedAt));
    return rows.map((row) =>
      toClass(
        row,
        lessonRows
          .filter((lesson) => lesson.classId === row.classId)
          .map((lesson) => ({
            addedAt: lesson.addedAt,
            lessonId: lesson.lessonId,
            title: lesson.title,
            version: lesson.lessonVersion,
          })),
      ),
    );
  }

  return {
    async isEducator(accountId) {
      const [row] = await db
        .select({ accountId: educators.accountId })
        .from(educators)
        .where(eq(educators.accountId, accountId));
      return !!row;
    },
    async enableEducator(accountId, at) {
      await db
        .insert(educators)
        .values({ accountId, enabledAt: at })
        .onDuplicateKeyUpdate({ set: { accountId } });
    },
    async create(input) {
      await db.insert(classes).values({
        audienceLock: input.controls.audienceLock,
        blockedCategories: input.controls.blockedCategories,
        classId: input.classId,
        createdAt: input.createdAt,
        curriculum: input.curriculum,
        joinCodeHash: input.joinCodeHash,
        joinCodeHint: input.joinCodeHint,
        level: input.level,
        name: input.name,
        ownerAccountId: input.ownerAccountId,
        tutorEnabled: input.controls.tutorEnabled,
      });
    },
    async listOwned(accountId) {
      return withLessons(
        await db
          .select()
          .from(classes)
          .where(eq(classes.ownerAccountId, accountId))
          .orderBy(asc(classes.createdAt)),
      );
    },
    async getOwned(accountId, classId) {
      const rows = await db
        .select()
        .from(classes)
        .where(and(eq(classes.ownerAccountId, accountId), eq(classes.classId, classId)));
      return (await withLessons(rows))[0];
    },
    async findOpenByCode(joinCodeHash) {
      const rows = await db.select().from(classes).where(eq(classes.joinCodeHash, joinCodeHash));
      const open = rows.filter((row) => row.archivedAt === null);
      return (await withLessons(open))[0];
    },
    async update(classId, changes) {
      const set: Partial<typeof classes.$inferInsert> = {};
      if (changes.name !== undefined) set.name = changes.name;
      if (changes.curriculum !== undefined) set.curriculum = changes.curriculum;
      if (changes.level !== undefined) set.level = changes.level;
      if (changes.archivedAt !== undefined) set.archivedAt = changes.archivedAt;
      if (changes.controls) {
        set.audienceLock = changes.controls.audienceLock;
        set.blockedCategories = changes.controls.blockedCategories;
        set.tutorEnabled = changes.controls.tutorEnabled;
      }
      if (Object.keys(set).length > 0) {
        await db.update(classes).set(set).where(eq(classes.classId, classId));
      }
    },
    async setJoinCode(classId, joinCodeHash, joinCodeHint) {
      await db
        .update(classes)
        .set({ joinCodeHash, joinCodeHint })
        .where(eq(classes.classId, classId));
    },
    async addLesson(classId, lesson) {
      await db
        .insert(classLessons)
        .values({
          addedAt: lesson.addedAt,
          classId,
          lessonId: lesson.lessonId,
          lessonVersion: lesson.version,
          title: lesson.title,
        })
        .onDuplicateKeyUpdate({ set: { lessonVersion: lesson.version, title: lesson.title } });
    },
    async removeLesson(classId, lessonId) {
      await db
        .delete(classLessons)
        .where(and(eq(classLessons.classId, classId), eq(classLessons.lessonId, lessonId)));
    },
    async swapLesson(accountId, fromLessonId, to) {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select({ addedAt: classLessons.addedAt, classId: classLessons.classId })
          .from(classLessons)
          .innerJoin(classes, eq(classes.classId, classLessons.classId))
          .where(
            and(eq(classes.ownerAccountId, accountId), eq(classLessons.lessonId, fromLessonId)),
          );
        for (const row of rows) {
          await tx
            .delete(classLessons)
            .where(
              and(eq(classLessons.classId, row.classId), eq(classLessons.lessonId, fromLessonId)),
            );
          // Kept in its place in the list: the edited lesson takes the original's added time.
          await tx
            .insert(classLessons)
            .values({
              addedAt: row.addedAt,
              classId: row.classId,
              lessonId: to.lessonId,
              lessonVersion: to.version,
              title: to.title,
            })
            .onDuplicateKeyUpdate({ set: { lessonVersion: to.version, title: to.title } });
        }
        return rows.length;
      });
    },
    async deleteArchivedBefore(before) {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select({ classId: classes.classId })
          .from(classes)
          .where(and(isNotNull(classes.archivedAt), lte(classes.archivedAt, before)));
        const ids = rows.map((row) => row.classId);
        if (ids.length === 0) return 0;
        await tx.delete(classLessons).where(inArray(classLessons.classId, ids));
        await tx.delete(classActivity).where(inArray(classActivity.classId, ids));
        await tx.delete(classes).where(inArray(classes.classId, ids));
        return ids.length;
      });
    },
    async recordActivity(classId, week, metric) {
      await db
        .insert(classActivity)
        .values({ classId, count: 1, metric, week })
        .onDuplicateKeyUpdate({ set: { count: sql`${classActivity.count} + 1` } });
    },
    async activity(classId) {
      return db
        .select({
          count: classActivity.count,
          metric: classActivity.metric,
          week: classActivity.week,
        })
        .from(classActivity)
        .where(eq(classActivity.classId, classId));
    },
    async deleteActivityBefore(week) {
      const [result] = await db.delete(classActivity).where(lt(classActivity.week, week));
      return result.affectedRows;
    },
  };
}
