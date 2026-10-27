import type { TutorTurn } from "@sbi/contracts";

export interface TutorTurnRepository {
  save(turn: TutorTurn): Promise<void>;
  listBySession(sessionId: string): Promise<TutorTurn[]>;
  /** Supports the learner's reset/delete control; returns how many turns were removed. */
  deleteBySession(sessionId: string): Promise<number>;
}
