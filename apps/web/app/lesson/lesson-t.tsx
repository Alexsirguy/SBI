import { Fragment, type ReactNode } from "react";
import { useErrorText as useGeneralErrorText } from "../i18n/error-text";
import { useT } from "../i18n/provider";
import type { Messages } from "../i18n/messages";
import { UNREADABLE } from "./stream";

export type LessonKey = keyof Messages["lesson"] & string;
export type LessonT = (key: LessonKey, values?: Record<string, string | number>) => string;

/** Fills `{slot}` placeholders with elements, so a translation can move a link or emphasis. */
export function rich(template: string, slots: Record<string, ReactNode>): ReactNode {
  return template
    .split(/\{(\w+)\}/)
    .map((part, index) => (
      <Fragment key={index}>{index % 2 === 1 ? (slots[part] ?? `{${part}}`) : part}</Fragment>
    ));
}

/** The general translations plus the lesson stream's own "could not read" message. */
export function useErrorText() {
  const t = useT("lesson");
  const general = useGeneralErrorText();
  return (message: string | undefined) =>
    message === UNREADABLE ? t("unreadable") : general(message);
}
