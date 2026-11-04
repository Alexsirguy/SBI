import {
  BROWSER_EVENTS,
  EventContext,
  type BrowserEventName,
  type BrowserEventProps,
} from "./browser-events";
import { payloadProblems } from "./guard";

/** Where checked browser events go; swappable so tests and dev never reach a vendor. */
export interface BrowserSink {
  send(name: BrowserEventName, props: Record<string, unknown>): void;
  /** Forgets the visit, as when consent is withdrawn. */
  reset(): void;
}

export type Track = <N extends BrowserEventName>(name: N, props: BrowserEventProps<N>) => boolean;

/**
 * Checks every event against its schema and the payload guard before the sink sees it.
 * `context` returns undefined whenever nothing may be sent: no consent, or a child.
 */
export function createTracker(options: {
  sink: BrowserSink;
  context: () => EventContext | undefined;
  onReject?: (name: string, problems: string[]) => void;
}): Track {
  return (name, props) => {
    const context = options.context();
    if (!context) return false;
    const parsed = BROWSER_EVENTS[name].safeParse(props);
    const shared = EventContext.safeParse(context);
    const problems = [
      ...(parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)),
      ...(shared.success ? [] : shared.error.issues.map((issue) => `context: ${issue.message}`)),
    ];
    const payload = { ...context, ...(parsed.data ?? {}) };
    problems.push(...payloadProblems(payload));
    if (problems.length > 0) {
      options.onReject?.(name, problems);
      return false;
    }
    options.sink.send(name, payload);
    return true;
  };
}

/** Keeps events in memory, for tests. */
export function memorySink(): BrowserSink & { events: { name: string; props: object }[] } {
  const events: { name: string; props: object }[] = [];
  return { events, send: (name, props) => events.push({ name, props }), reset: () => undefined };
}

export const noopSink: BrowserSink = { send: () => undefined, reset: () => undefined };
