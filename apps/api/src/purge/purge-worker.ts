import type { LockResult } from "@sbi/db";
import type { DeletionPassResult } from "@sbi/media";
import {
  startIntervalWorker,
  type IntervalWorker,
  type WorkerLog,
} from "../common/interval-worker";

export interface PurgePassResult extends DeletionPassResult {
  recognitionPurged: number;
  feedbackDetailsCleared: number;
  tutorTurnsPurged: number;
  evidencePacksPurged: number;
  catalogGapsPurged: number;
}

export interface PurgeWorkerOptions {
  intervalMs: number;
  runPass: () => Promise<LockResult<PurgePassResult>>;
  log: WorkerLog;
}

export type PurgeWorker = IntervalWorker;

export function startPurgeWorker(options: PurgeWorkerOptions): PurgeWorker {
  return startIntervalWorker({
    ...options,
    name: "media purge pass",
    summarise: ({
      auditPurged,
      deleted,
      recognitionPurged,
      stagingDeleted,
      feedbackDetailsCleared,
      tutorTurnsPurged,
      evidencePacksPurged,
      catalogGapsPurged,
    }) => ({
      auditPurged,
      deleted: deleted.length,
      recognitionPurged,
      stagingDeleted,
      feedbackDetailsCleared,
      tutorTurnsPurged,
      evidencePacksPurged,
      catalogGapsPurged,
    }),
  });
}
