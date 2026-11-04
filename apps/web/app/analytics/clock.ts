const START_KEY = "sbi.funnel-start";

// Session storage, so the clock survives the move to the lesson page but not the visit.
function session(): Pick<Storage, "getItem" | "setItem"> | undefined {
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

/** Milliseconds since the funnel started this visit, or undefined if it never did. */
export function sinceFunnelStart(now = Date.now()): number | undefined {
  const raw = session()?.getItem(START_KEY);
  const start = raw ? Number(raw) : NaN;
  return Number.isFinite(start) && now >= start ? now - start : undefined;
}
