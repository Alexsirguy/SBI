import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limiter";

describe("createRateLimiter", () => {
  it("lets a key through up to the limit within the window, then again once it slides", () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now });
    expect([limiter.allow("a"), limiter.allow("a"), limiter.allow("a")]).toEqual([
      true,
      true,
      false,
    ]);
    expect(limiter.allow("b")).toBe(true);
    now = 999;
    expect(limiter.allow("a")).toBe(false);
    now = 1000;
    expect(limiter.allow("a")).toBe(true);
  });
});
