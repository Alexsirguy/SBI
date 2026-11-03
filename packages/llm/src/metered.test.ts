import { describe, expect, it } from "vitest";
import { costOf, currentUsage, meterProvider, scopedProvider, withUsageScope } from "./metered";
import type { LlmProvider } from "./provider";

const fake: LlmProvider = {
  async complete() {
    return {
      latencyMs: 1,
      model: "m",
      text: "{}",
      usage: { cachedInputTokens: 200, inputTokens: 1000, outputTokens: 300 },
    };
  },
  id: "fake",
  model: "m",
};

describe("meterProvider", () => {
  it("adds up every call made through it, and only those", async () => {
    const metered = meterProvider(fake);
    await metered.provider.complete({ messages: [] });
    await metered.provider.complete({ messages: [] });
    await fake.complete({ messages: [] });

    expect(metered.usage()).toEqual({
      cachedInputTokens: 400,
      calls: 2,
      inputTokens: 2000,
      outputTokens: 600,
    });
    expect(metered.provider.id).toBe("fake");
  });
});

describe("costOf", () => {
  it("prices uncached input, cached input and output separately", () => {
    const cost = costOf(
      { cachedInputTokens: 200_000, inputTokens: 1_000_000, outputTokens: 500_000 },
      { cachedInput: 0.5, input: 2, output: 8 },
    );
    // 800k × $2 + 200k × $0.5 + 500k × $8, per million.
    expect(cost).toBe(5.7);
  });
});

describe("scoped usage", () => {
  it("adds calls to the request they ran in, including from nested helpers", async () => {
    const shared = scopedProvider(fake);
    const helper = () => shared.complete({ messages: [] });
    const [a, b] = await Promise.all([
      withUsageScope(async () => {
        await helper();
        await Promise.all([helper(), helper()]);
        return currentUsage();
      }),
      withUsageScope(async () => {
        await helper();
        return currentUsage();
      }),
    ]);

    expect(a?.calls).toBe(3);
    expect(b?.calls).toBe(1);
    expect(currentUsage()).toBeUndefined();
    await shared.complete({ messages: [] });
  });
});
