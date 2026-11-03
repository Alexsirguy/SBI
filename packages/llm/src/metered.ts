import type { LlmProvider, Usage } from "./provider";

export interface MeteredUsage extends Usage {
  calls: number;
}

/** Prices in US dollars per million tokens, as the provider bills them. */
export interface TokenPrices {
  input: number;
  cachedInput: number;
  output: number;
}

/** Wraps a provider so every call made through it adds to one running total, e.g. one lesson. */
export function meterProvider(provider: LlmProvider): {
  provider: LlmProvider;
  usage(): MeteredUsage;
} {
  const total: MeteredUsage = { cachedInputTokens: 0, calls: 0, inputTokens: 0, outputTokens: 0 };
  return {
    provider: {
      id: provider.id,
      model: provider.model,
      async complete(request) {
        const completion = await provider.complete(request);
        total.calls += 1;
        total.inputTokens += completion.usage.inputTokens;
        total.cachedInputTokens += completion.usage.cachedInputTokens;
        total.outputTokens += completion.usage.outputTokens;
        return completion;
      },
    },
    usage: () => ({ ...total }),
  };
}

/** Cost in US dollars; cached input tokens are billed at their own rate, not twice. */
export function costOf(usage: Usage, prices: TokenPrices): number {
  const uncached = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  const dollars =
    (uncached * prices.input +
      usage.cachedInputTokens * prices.cachedInput +
      usage.outputTokens * prices.output) /
    1_000_000;
  return Math.round(dollars * 1_000_000) / 1_000_000;
}
