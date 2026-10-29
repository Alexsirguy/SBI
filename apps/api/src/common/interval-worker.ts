import type { LockResult } from "@sbi/db";

export interface WorkerLog {
  info(details: object, message: string): void;
  error(details: object, message: string): void;
}

export interface IntervalWorkerOptions<T> {
  name: string;
  intervalMs: number;
  runPass: () => Promise<LockResult<T>>;
  /** What to log for a finished pass; counts only, never keys or content. */
  summarise: (value: T) => object;
  log: WorkerLog;
}

export interface IntervalWorker {
  tick(): Promise<void>;
  stop(): void;
}

// One pass per interval; the database lock keeps other API instances from running it concurrently.
export function startIntervalWorker<T>(options: IntervalWorkerOptions<T>): IntervalWorker {
  let running = false;
  async function tick() {
    if (running) {
      return;
    }
    running = true;
    try {
      const result = await options.runPass();
      if (result.acquired) {
        options.log.info(options.summarise(result.value), options.name);
      }
    } catch (error) {
      options.log.error({ err: error }, `${options.name} failed`);
    } finally {
      running = false;
    }
  }
  const timer = setInterval(() => void tick(), options.intervalMs);
  timer.unref();
  void tick();
  return { stop: () => clearInterval(timer), tick };
}
