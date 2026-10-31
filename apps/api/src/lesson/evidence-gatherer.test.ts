import type { GatheredEvidence } from "@sbi/evidence";
import { describe, expect, it, vi } from "vitest";
import { backgroundGathers, lessonFirst } from "./evidence-gatherer";

const pack = { reused: true, claims: [], pack: {} } as unknown as GatheredEvidence;

describe("lessonFirst", () => {
  it("uses a stored pack at once and gathers nothing", async () => {
    const gather = vi.fn();
    const result = await lessonFirst("stored", { stored: async () => pack, gather });
    expect(result).toBe(pack);
    expect(gather).not.toHaveBeenCalled();
  });

  it("answers at once without evidence and gathers once in the background", async () => {
    let finish: ((value: GatheredEvidence) => void) | undefined;
    const gather = vi.fn(
      () =>
        new Promise<GatheredEvidence>((resolve) => {
          finish = resolve;
        }),
    );
    const steps = { stored: async () => undefined, gather };
    expect(await lessonFirst("cold", steps)).toBeUndefined();
    expect(await lessonFirst("cold", steps)).toBeUndefined();
    expect(gather).toHaveBeenCalledTimes(1);

    const done = { ...pack, pack: { questions: [] } } as unknown as GatheredEvidence;
    finish?.(done);
    await backgroundGathers();
    // Once it settles, a later cold request may try again.
    await lessonFirst("cold", steps);
    expect(gather).toHaveBeenCalledTimes(2);
    finish?.(done);
    await backgroundGathers();
  });

  it("keeps serving lessons when a background gather fails", async () => {
    const steps = {
      stored: async () => undefined,
      gather: async (): Promise<GatheredEvidence> => {
        throw new Error("sources down");
      },
    };
    expect(await lessonFirst("failing", steps)).toBeUndefined();
    await expect(backgroundGathers()).resolves.toBeUndefined();
  });
});
