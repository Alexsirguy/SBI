/** A learner followed a "next concept" suggestion (#106); ids and rank only, never who. */
export interface NextConceptEvent {
  type: "next-concept";
  fromLessonId: string;
  toTaxonomyId: string;
  /** Position in the list as shown, from 0, so ranking can be judged. */
  rank: number;
  at: string;
}

/** What writing or serving one completed lesson cost (#110); tokens, never text or learner. */
export interface LessonCostEvent {
  type: "lesson-cost";
  /** Null when no lesson was served: refused for safety or age, or failed. */
  lessonId: string | null;
  version: number | null;
  /** "cached" costs only the checks before reuse; "fallback" served a related lesson instead. */
  outcome: "fresh" | "cached" | "fallback" | "refused" | "failed";
  calls: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  /** Null until token prices are configured. */
  costUsd: number | null;
  at: string;
}

export type AnalyticsEvent = NextConceptEvent | LessonCostEvent;

export type EventSink = (event: AnalyticsEvent) => void;

/** Writes events as structured log lines until the event pipeline exists. */
// TODO(#76) send these to the typed event pipeline instead of the log.
export function createLogSink(log: (line: string) => void): EventSink {
  return (event) => log(JSON.stringify(event));
}
