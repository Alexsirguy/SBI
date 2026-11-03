import { AsyncLocalStorage } from "node:async_hooks";
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

const scope = new AsyncLocalStorage<MeteredUsage>();

/**
 * Wraps a shared provider so each call adds to the usage of whichever request it runs inside
 * (see `withUsageScope`); calls outside any scope are not counted.
 */
export function scopedProvider(provider: LlmProvider): LlmProvider {
  return {
    id: provider.id,
    model: provider.model,
    async complete(request) {
      const completion = await provider.complete(request);
      const total = scope.getStore();
      if (total) {
        total.calls += 1;
        total.inputTokens += completion.usage.inputTokens;
        total.cachedInputTokens += completion.usage.cachedInputTokens;
        total.outputTokens += completion.usage.outputTokens;
      }
      return completion;
    },
  };
}

/** Runs one request so every scoped provider call inside it, however deep, adds to one total. */
export function withUsageScope<T>(fn: () => Promise<T>): Promise<T> {
  return scope.run({ cachedInputTokens: 0, calls: 0, inputTokens: 0, outputTokens: 0 }, fn);
}

/** The current request's usage so far, or undefined outside a scope. */
export function currentUsage(): MeteredUsage | undefined {
  const total = scope.getStore();
  return total ? { ...total } : undefined;
}
