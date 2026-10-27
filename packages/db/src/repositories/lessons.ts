import { Lesson } from "@sbi/contracts";
import type { LessonRepository } from "@sbi/orchestrator";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../client";
import { lessons } from "../schema";
import { parseDocuments } from "./document";

export function createLessonRepository(db: Database): LessonRepository {
  const select = () => db.select({ document: lessons.document }).from(lessons);

  return {
    async save(input) {
      const lesson = Lesson.parse(input);
      const row = {
        lessonId: lesson.lessonId,
        version: lesson.version,
        taxonomyId: lesson.taxonomyId,
        locale: lesson.locale,
        reviewStatus: lesson.reviewStatus,
        safetyClass: lesson.safetyClass,
        cacheScope: lesson.reuse.cacheScope,
        intentSignature: lesson.reuse.intentSignature,
        contentHash: lesson.reuse.contentHash,
        document: lesson,
      };
      await db.insert(lessons).values(row).onDuplicateKeyUpdate({ set: row });
    },
    async get(lessonId, version) {
      const rows = await select()
        .where(and(eq(lessons.lessonId, lessonId), eq(lessons.version, version)))
        .limit(1);
      return parseDocuments(Lesson, rows)[0];
    },
    async latest(lessonId) {
      const rows = await select()
        .where(eq(lessons.lessonId, lessonId))
        .orderBy(desc(lessons.version))
        .limit(1);
      return parseDocuments(Lesson, rows)[0];
    },
    async findByIntent(intentSignature) {
      const rows = await select()
        .where(eq(lessons.intentSignature, intentSignature))
        .orderBy(lessons.lessonId, desc(lessons.version));
      return parseDocuments(Lesson, rows);
    },
  };
}
