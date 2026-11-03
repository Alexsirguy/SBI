import type { RetentionClass, TutorTurn } from "@sbi/contracts";

/** Whose conversation: a signed-in learner's account, or one signed-out visit. */
export type ConversationOwner = { accountId: string } | { sessionId: string };

export interface TutorTurnRepository {
  save(turn: TutorTurn): Promise<void>;
  listBySession(sessionId: string): Promise<TutorTurn[]>;
  /** One lesson's conversation, oldest first. */
  listConversation(owner: ConversationOwner, lessonId: string): Promise<TutorTurn[]>;
  /** Every turn tied to the account, for its export. */
  listByAccount(accountId: string): Promise<TutorTurn[]>;
  /** The learner's reset: one lesson's conversation; returns how many turns were removed. */
  deleteConversation(owner: ConversationOwner, lessonId: string): Promise<number>;
  /** Supports the learner's reset/delete control; returns how many turns were removed. */
  deleteBySession(sessionId: string): Promise<number>;
  /** Removes turns of one retention class created before the cutoff (§12 TTL). */
  deleteCreatedBefore(retentionClass: RetentionClass, before: Date): Promise<number>;
}
