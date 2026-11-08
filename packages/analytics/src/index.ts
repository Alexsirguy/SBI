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

/** Server events carry no learner, so they stay in our own logs and never reach Mixpanel (ADR 0026). */
export function createLogSink(log: (line: string) => void): EventSink {
  return (event) => log(JSON.stringify(event));
}

export * from "./browser-events";
export * from "./buckets";
export { payloadProblems } from "./guard";
export * from "./tracker";
export * from "./classroom";
