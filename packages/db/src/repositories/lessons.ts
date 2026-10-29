import { Lesson } from "@sbi/contracts";
import type { LessonRepository } from "@sbi/orchestrator";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "../client";
import { lessonClaims, lessons } from "../schema";
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
      const key = { lessonId: lesson.lessonId, version: lesson.version };
      await db.transaction(async (tx) => {
        await tx.insert(lessons).values(row).onDuplicateKeyUpdate({ set: row });
        await tx
          .delete(lessonClaims)
          .where(
            and(eq(lessonClaims.lessonId, key.lessonId), eq(lessonClaims.version, key.version)),
          );
        await tx
          .insert(lessonClaims)
          .values(lesson.claims.map((claim) => ({ ...key, claimId: claim.claimId })));
      });
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
    async findByClaimIds(claimIds) {
      if (claimIds.length === 0) return [];
      const rows = await db
        .selectDistinct({
          document: lessons.document,
          lessonId: lessons.lessonId,
          version: lessons.version,
        })
        .from(lessons)
        .innerJoin(
          lessonClaims,
          and(
            eq(lessonClaims.lessonId, lessons.lessonId),
            eq(lessonClaims.version, lessons.version),
          ),
        )
        .where(inArray(lessonClaims.claimId, claimIds))
        .orderBy(lessons.lessonId, desc(lessons.version));
      return parseDocuments(Lesson, rows);
    },
  };
}
