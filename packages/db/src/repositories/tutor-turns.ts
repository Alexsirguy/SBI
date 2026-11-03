import { TutorTurn } from "@sbi/contracts";
import type { ConversationOwner, TutorTurnRepository } from "@sbi/tutor";
import { and, eq, lt } from "drizzle-orm";
import type { Database } from "../client";
import { tutorTurns } from "../schema";
import { parseDocuments } from "./document";

const owned = (owner: ConversationOwner) =>
  "accountId" in owner
    ? eq(tutorTurns.accountId, owner.accountId)
    : eq(tutorTurns.sessionId, owner.sessionId);

export function createTutorTurnRepository(db: Database): TutorTurnRepository {
  return {
    async save(input) {
      const turn = TutorTurn.parse(input);
      const row = {
        sessionId: turn.sessionId,
        turnId: turn.turnId,
        accountId: turn.accountId ?? null,
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
    async listConversation(owner, lessonId) {
      const rows = await db
        .select({ document: tutorTurns.document })
        .from(tutorTurns)
        .where(and(owned(owner), eq(tutorTurns.lessonId, lessonId)))
        .orderBy(tutorTurns.createdAt);
      return parseDocuments(TutorTurn, rows);
    },
    async listByAccount(accountId) {
      const rows = await db
        .select({ document: tutorTurns.document })
        .from(tutorTurns)
        .where(eq(tutorTurns.accountId, accountId))
        .orderBy(tutorTurns.createdAt);
      return parseDocuments(TutorTurn, rows);
    },
    async deleteConversation(owner, lessonId) {
      const [result] = await db
        .delete(tutorTurns)
        .where(and(owned(owner), eq(tutorTurns.lessonId, lessonId)));
      return result.affectedRows;
    },
    async deleteBySession(sessionId) {
      const [result] = await db.delete(tutorTurns).where(eq(tutorTurns.sessionId, sessionId));
      return result.affectedRows;
    },
    async deleteCreatedBefore(retentionClass, before) {
      const [result] = await db
        .delete(tutorTurns)
        .where(
          and(eq(tutorTurns.retentionClass, retentionClass), lt(tutorTurns.createdAt, before)),
        );
      return result.affectedRows;
    },
  };
}
