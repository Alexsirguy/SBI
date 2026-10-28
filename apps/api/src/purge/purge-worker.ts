import type { LockResult } from "@sbi/db";
import type { DeletionPassResult } from "@sbi/media";

export interface PurgeWorkerOptions {
  intervalMs: number;
  runPass: () => Promise<LockResult<DeletionPassResult>>;
  log: {
    info(details: object, message: string): void;
    error(details: object, message: string): void;
  };
}

export interface PurgeWorker {
  tick(): Promise<void>;
  stop(): void;
}

// One pass per interval; the database lock keeps other API instances from running it concurrently.
export function startPurgeWorker(options: PurgeWorkerOptions): PurgeWorker {
  let running = false;
  async function tick() {
    if (running) {
      return;
    }
    running = true;
    try {
      const result = await options.runPass();
      if (result.acquired) {
        const { auditPurged, deleted, stagingDeleted } = result.value;
        options.log.info(
          { auditPurged, deleted: deleted.length, stagingDeleted },
          "media purge pass",
        );
      }
    } catch (error) {
      options.log.error({ err: error }, "media purge pass failed");
    } finally {
      running = false;
    }
  }
  const timer = setInterval(() => void tick(), options.intervalMs);
  timer.unref();
  void tick();
  return { stop: () => clearInterval(timer), tick };
}
