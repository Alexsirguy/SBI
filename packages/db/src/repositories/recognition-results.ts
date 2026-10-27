import { RecognitionResult } from "@sbi/contracts";
import type { RecognitionResultRepository } from "@sbi/recognition";
import { eq, lte } from "drizzle-orm";
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
    async listBySession(sessionId) {
      const rows = await db
        .select({ document: recognitionResults.document })
        .from(recognitionResults)
        .where(eq(recognitionResults.sessionId, sessionId))
        .orderBy(recognitionResults.createdAt);
      return parseDocuments(RecognitionResult, rows);
    },
    async deleteExpired(now) {
      const [result] = await db
        .delete(recognitionResults)
        .where(lte(recognitionResults.deleteBy, now));
      return result.affectedRows;
    },
  };
}
