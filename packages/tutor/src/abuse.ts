import type { TutorTurn } from "@sbi/contracts";

type Struck = Pick<TutorTurn, "createdAt"> & { response: Pick<TutorTurn["response"], "policy"> };

/** Harm-seeking turns within the window that start a cooldown; one or two can be curiosity. */
export const HARM_STRIKES = 3;
export const STRIKE_WINDOW_MS = 15 * 60_000;
export const COOLDOWN_MS = 15 * 60_000;

/** Milliseconds until this conversation may ask again, or 0; read from history so restarts keep it. */
export function cooldownRemaining(history: readonly Struck[], now: Date): number {
  const strikes = history
    .filter((turn) => turn.response.policy?.reason === "harm")
    .map((turn) => Date.parse(turn.createdAt));
  return remainingAfter(strikes, now.getTime());
}

function remainingAfter(times: readonly number[], at: number): number {
  const strikes = times
    .filter((time) => at - time < STRIKE_WINDOW_MS + COOLDOWN_MS)
    .sort((a, b) => a - b);
  for (let last = strikes.length - 1; last >= HARM_STRIKES - 1; last -= 1) {
    const end = strikes[last] ?? 0;
    const start = strikes[last - HARM_STRIKES + 1] ?? 0;
    if (end - start < STRIKE_WINDOW_MS) return Math.max(0, end + COOLDOWN_MS - at);
  }
  return 0;
}

export interface StrikeCounter {
  strike(key: string): void;
  remaining(key: string): number;
}

/** The same rule per client, in memory, so switching to a fresh visit doesn't reset it. */
export function createStrikeCounter(now: () => number = Date.now): StrikeCounter {
  const seen = new Map<string, number[]>();
  const recent = (key: string, at: number) =>
    (seen.get(key) ?? []).filter((time) => at - time < STRIKE_WINDOW_MS + COOLDOWN_MS);
  return {
    strike(key) {
      const at = now();
      seen.set(key, [...recent(key, at), at]);
      // Forget idle clients now and then, so memory follows active ones only.
      if (seen.size > 10_000) {
        for (const [other] of seen) if (recent(other, at).length === 0) seen.delete(other);
      }
    },
    remaining(key) {
      const at = now();
      return remainingAfter(recent(key, at), at);
    },
  };
}
