import { format } from "../i18n/format";
import type { Messages } from "../i18n/messages";
import english from "../i18n/messages/en/capture.json";

export type CaptureKey = keyof Messages["capture"] & string;
export type CaptureT = (key: CaptureKey, values?: Record<string, string | number>) => string;

// Plain helpers run outside components too (and in tests), so they fall back to English.
export const englishCapture: CaptureT = (key, values) => format(english[key], values);

/** A capture failure the learner sees, carrying its message key so the form can translate it. */
export class CaptureError extends Error {
  constructor(readonly key: CaptureKey) {
    super(englishCapture(key));
  }
}
