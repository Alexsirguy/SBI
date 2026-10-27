import type { RecognitionResult } from "@sbi/contracts";

export interface RecognitionResultRepository {
  save(result: RecognitionResult): Promise<void>;
  listBySession(sessionId: string): Promise<RecognitionResult[]>;
  /** Deletes results past their deadline and returns how many were removed. */
  deleteExpired(now: Date): Promise<number>;
}
