import { and, asc, eq, inArray, isNotNull, lte } from "drizzle-orm";
import type { Database } from "../client";
import { classes, classLessons, educators } from "../schema";

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
  /** Deletes classes archived on or before `before`, with their lessons; returns how many. */
  deleteArchivedBefore(before: Date): Promise<number>;
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
    async deleteArchivedBefore(before) {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select({ classId: classes.classId })
          .from(classes)
          .where(and(isNotNull(classes.archivedAt), lte(classes.archivedAt, before)));
        const ids = rows.map((row) => row.classId);
        if (ids.length === 0) return 0;
        await tx.delete(classLessons).where(inArray(classLessons.classId, ids));
        await tx.delete(classes).where(inArray(classes.classId, ids));
        return ids.length;
      });
    },
  };
}
