/** A learner followed a "next concept" suggestion (#106); ids and rank only, never who. */
export interface NextConceptEvent {
  type: "next-concept";
  fromLessonId: string;
  toTaxonomyId: string;
  /** Position in the list as shown, from 0, so ranking can be judged. */
  rank: number;
  at: string;
}

export type AnalyticsEvent = NextConceptEvent;

export type EventSink = (event: AnalyticsEvent) => void;

/** Writes events as structured log lines until the event pipeline exists. */
// TODO(#76) send these to the typed event pipeline instead of the log.
export function createLogSink(log: (line: string) => void): EventSink {
  return (event) => log(JSON.stringify(event));
}
