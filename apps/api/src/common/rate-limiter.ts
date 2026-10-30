/** Counts requests per key in a sliding window; `allow` records the request when it is let through. */
export interface RateLimiter {
  allow(key: string): boolean;
}

// In-memory and per instance: enough to stop one client flooding one API process.
// TODO(#120): move to the shared limits and quotas once that store exists.
export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): RateLimiter {
  const now = options.now ?? Date.now;
  const seen = new Map<string, number[]>();
  return {
    allow(key) {
      const at = now();
      const recent = (seen.get(key) ?? []).filter((time) => at - time < options.windowMs);
      if (recent.length >= options.limit) {
        seen.set(key, recent);
        return false;
      }
      recent.push(at);
      seen.set(key, recent);
      // Drop idle keys now and then, so memory follows active clients only.
      if (seen.size > 10_000) {
        for (const [other, times] of seen) {
          if (times.every((time) => at - time >= options.windowMs)) seen.delete(other);
        }
      }
      return true;
    },
  };
}
