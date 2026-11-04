import { track } from "./track";

const START_KEY = "sbi.funnel-start";

// Session storage, so the clock survives the move to the lesson page but not the visit.
function session(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

/** Starts the time-to-value clock when the learner begins a capture or a typed question. */
export function markFunnelStart(now = Date.now()) {
  session()?.setItem(START_KEY, String(now));
}

/**
 * When the current capture started, taken once: the lesson it led to clears it, so a lesson
 * opened later from a link times itself from its own page load instead.
 */
export function takeFunnelStart(now = Date.now()): number | undefined {
  const storage = session();
  const raw = storage?.getItem(START_KEY);
  storage?.removeItem(START_KEY);
  const start = raw ? Number(raw) : NaN;
  return Number.isFinite(start) && now >= start ? start : undefined;
}

type Metric = "time_to_label" | "first_readable_lesson" | "interactive_ready";

/**
 * Records one service-level timing (spec §10): a performance mark the CI budgets read, and,
 * with consent, a `timing_measured` event so Mixpanel can give real p50/p95 per device tier.
 */
export function markTiming(metric: Metric, ms: number) {
  try {
    performance.mark(`sbi:${metric}`, { detail: { ms } });
  } catch {
    // Marks are a measurement aid; a browser without them still sends the event.
  }
  track("timing_measured", { metric, ms: Math.min(Math.round(ms), 600_000) });
}
