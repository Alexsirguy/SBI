import { TutorTurn } from "@sbi/contracts";
import type { TutorTurnRepository } from "@sbi/tutor";
import { eq } from "drizzle-orm";
import type { Database } from "../client";
import { tutorTurns } from "../schema";
import { parseDocuments } from "./document";

export function createTutorTurnRepository(db: Database): TutorTurnRepository {
  return {
    async save(input) {
      const turn = TutorTurn.parse(input);
      const row = {
        sessionId: turn.sessionId,
        turnId: turn.turnId,
        lessonId: turn.lessonId,
        lessonVersion: turn.lessonVersion,
        retentionClass: turn.retentionClass,
        createdAt: new Date(turn.createdAt),
        document: turn,
      };
      await db.insert(tutorTurns).values(row).onDuplicateKeyUpdate({ set: row });
    },
    async listBySession(sessionId) {
      const rows = await db
        .select({ document: tutorTurns.document })
        .from(tutorTurns)
        .where(eq(tutorTurns.sessionId, sessionId))
        .orderBy(tutorTurns.createdAt);
      return parseDocuments(TutorTurn, rows);
    },
    async deleteBySession(sessionId) {
      const [result] = await db.delete(tutorTurns).where(eq(tutorTurns.sessionId, sessionId));
      return result.affectedRows;
    },
  };
}
