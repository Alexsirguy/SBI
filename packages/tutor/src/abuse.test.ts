import { policyResponse } from "@sbi/safety";
import { describe, expect, it } from "vitest";
import { COOLDOWN_MS, cooldownRemaining, createStrikeCounter, STRIKE_WINDOW_MS } from "./abuse";

const NOW = Date.parse("2026-11-03T10:00:00Z");
const minutes = (n: number) => n * 60_000;

const turnAt = (offsetMs: number, harm = true) => ({
  createdAt: new Date(NOW + offsetMs).toISOString(),
  response: harm ? { policy: policyResponse("weapons") } : {},
});

describe("cooldownRemaining", () => {
  it("starts a cooldown after three harm-seeking turns close together", () => {
    const history = [turnAt(-minutes(6)), turnAt(-minutes(4)), turnAt(-minutes(2))];
    expect(cooldownRemaining(history, new Date(NOW))).toBe(COOLDOWN_MS - minutes(2));
  });

  it("lets two harm turns, ordinary turns and spread-out strikes through", () => {
    expect(cooldownRemaining([turnAt(-1), turnAt(-2)], new Date(NOW))).toBe(0);
    const ordinary = [turnAt(-3, false), turnAt(-2, false), turnAt(-1, false)];
    expect(cooldownRemaining(ordinary, new Date(NOW))).toBe(0);
    const spread = [turnAt(-STRIKE_WINDOW_MS * 2), turnAt(-STRIKE_WINDOW_MS), turnAt(-1)];
    expect(cooldownRemaining(spread, new Date(NOW))).toBe(0);
  });

  it("ends once the cooldown has passed", () => {
    const history = [turnAt(-minutes(20)), turnAt(-minutes(19)), turnAt(-minutes(18))];
    expect(cooldownRemaining(history, new Date(NOW + COOLDOWN_MS))).toBe(0);
  });
});

describe("createStrikeCounter", () => {
  it("applies the same rule per client key", () => {
    let at = NOW;
    const strikes = createStrikeCounter(() => at);
    strikes.strike("1.2.3.4");
    strikes.strike("1.2.3.4");
    expect(strikes.remaining("1.2.3.4")).toBe(0);
    strikes.strike("1.2.3.4");
    expect(strikes.remaining("1.2.3.4")).toBe(COOLDOWN_MS);
    expect(strikes.remaining("5.6.7.8")).toBe(0);
    at += COOLDOWN_MS;
    expect(strikes.remaining("1.2.3.4")).toBe(0);
  });
});
