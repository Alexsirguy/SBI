import { RecognitionResult } from "@sbi/contracts";
import type { RecognitionResultRepository } from "@sbi/recognition";
import { and, desc, eq, gt, gte, lte } from "drizzle-orm";
import type { Database } from "../client";
import { recognitionResults } from "../schema";
import { parseDocuments } from "./document";

export function createRecognitionResultRepository(db: Database): RecognitionResultRepository {
  return {
    async save(input) {
      const result = RecognitionResult.parse(input);
      await db.insert(recognitionResults).values({
        resultId: result.resultId,
        sessionId: result.sessionId,
        imageSha256: result.imageSha256,
        createdAt: new Date(result.createdAt),
        deleteBy: new Date(result.deleteBy),
        document: result,
      });
    },
    async get(resultId) {
      const rows = await db
        .select({ document: recognitionResults.document })
        .from(recognitionResults)
        .where(eq(recognitionResults.resultId, resultId));
      return parseDocuments(RecognitionResult, rows)[0];
    },
    async update(input) {
      const result = RecognitionResult.parse(input);
      const [outcome] = await db
        .update(recognitionResults)
        .set({ document: result })
        .where(eq(recognitionResults.resultId, result.resultId));
      return outcome.affectedRows > 0;
    },
    async listBySession(sessionId) {
      const rows = await db
        .select({ document: recognitionResults.document })
        .from(recognitionResults)
        .where(eq(recognitionResults.sessionId, sessionId))
        .orderBy(recognitionResults.createdAt);
      return parseDocuments(RecognitionResult, rows);
    },
    async listSince(since) {
      const rows = await db
        .select({ document: recognitionResults.document })
        .from(recognitionResults)
        .where(gte(recognitionResults.createdAt, since))
        .orderBy(recognitionResults.createdAt);
      return parseDocuments(RecognitionResult, rows);
    },
    async findByImage(imageSha256, now) {
      const rows = await db
        .select({ document: recognitionResults.document })
        .from(recognitionResults)
        .where(
          and(
            eq(recognitionResults.imageSha256, imageSha256),
            gt(recognitionResults.deleteBy, now),
          ),
        )
        .orderBy(desc(recognitionResults.createdAt))
        .limit(1);
      return parseDocuments(RecognitionResult, rows)[0];
    },
    async deleteExpired(now) {
      const [result] = await db
        .delete(recognitionResults)
        .where(lte(recognitionResults.deleteBy, now));
      return result.affectedRows;
    },
  };
}
