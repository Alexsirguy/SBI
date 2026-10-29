import type { RecognitionResult } from "@sbi/contracts";

export interface RecognitionResultRepository {
  save(result: RecognitionResult): Promise<void>;
  get(resultId: string): Promise<RecognitionResult | undefined>;
  /** Replaces the stored record, e.g. after the learner confirms; false when it was deleted. */
  update(result: RecognitionResult): Promise<boolean>;
  listBySession(sessionId: string): Promise<RecognitionResult[]>;
  /** Deletes results past their deadline and returns how many were removed. */
  deleteExpired(now: Date): Promise<number>;
}
