import { afterEach, describe, expect, it, vi } from "vitest";
import { startPurgeWorker, type PurgePassResult } from "./purge-worker";

const RESULT: PurgePassResult = {
  auditPurged: 1,
  deleted: ["photos/a.jpg"],
  recognitionPurged: 3,
  stagingDeleted: 2,
  feedbackDetailsCleared: 4,
  tutorTurnsPurged: 5,
  evidencePacksPurged: 6,
  catalogGapsPurged: 7,
};

function logger() {
  return { error: vi.fn(), info: vi.fn() };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("startPurgeWorker", () => {
  it("runs a pass at start and on every interval, logging counts but no keys", async () => {
    vi.useFakeTimers();
    const runPass = vi.fn(async () => ({ acquired: true as const, value: RESULT }));
    const log = logger();
    const worker = startPurgeWorker({ intervalMs: 1000, log, runPass });

    await vi.advanceTimersByTimeAsync(2500);
    worker.stop();
    await vi.advanceTimersByTimeAsync(5000);

    expect(runPass).toHaveBeenCalledTimes(3);
    expect(log.info).toHaveBeenCalledWith(
      {
        auditPurged: 1,
        deleted: 1,
        recognitionPurged: 3,
        stagingDeleted: 2,
        feedbackDetailsCleared: 4,
        tutorTurnsPurged: 5,
        evidencePacksPurged: 6,
        catalogGapsPurged: 7,
      },
      "media purge pass",
    );
  });

  it("skips overlapping passes and stays quiet when another instance holds the lock", async () => {
    let finish: (() => void) | undefined;
    const runPass = vi.fn(
      () =>
        new Promise<{ acquired: false }>((resolve) => {
          finish = () => resolve({ acquired: false });
        }),
    );
    const log = logger();
    const worker = startPurgeWorker({ intervalMs: 60_000, log, runPass });
    await worker.tick();
    expect(runPass).toHaveBeenCalledTimes(1);
    finish?.();
    await vi.waitFor(() => expect(log.info).not.toHaveBeenCalled());
    worker.stop();
  });

  it("logs a failed pass and keeps running", async () => {
    const runPass = vi
      .fn()
      .mockRejectedValueOnce(new Error("storage unavailable"))
      .mockResolvedValue({ acquired: true, value: RESULT });
    const log = logger();
    const worker = startPurgeWorker({ intervalMs: 60_000, log, runPass });
    await vi.waitFor(() => expect(log.error).toHaveBeenCalledTimes(1));
    await worker.tick();
    expect(log.info).toHaveBeenCalledTimes(1);
    worker.stop();
  });
});
