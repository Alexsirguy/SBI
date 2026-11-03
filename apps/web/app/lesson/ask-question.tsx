"use client";

import { useRouter } from "next/navigation";
import { Button, TextField } from "@sbi/ui";
import { useRef, useState } from "react";
import { useT } from "../i18n/provider";
import { lessonHref, type LessonSubjectRef } from "./lesson-request";
import type { LessonPrefs } from "./prefs";

/** Lets the learner ask their own question about the same object, at the same depth. */
export function AskQuestion({ subject, prefs }: { subject: LessonSubjectRef; prefs: LessonPrefs }) {
  const { label } = subject;
  const t = useT("lesson");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string>();
  return (
    <form
      aria-label={t("askForm")}
      className="ask-question"
      onSubmit={(event) => {
        event.preventDefault();
        if (question.trim().length < 3) {
          setError(t("askTooShort"));
          inputRef.current?.focus();
          return;
        }
        setError(undefined);
        router.push(lessonHref(subject, { question: question.trim(), prefs }));
      }}
    >
      <TextField
        ref={inputRef}
        label={t("askLabel", { label: label.toLowerCase() })}
        type="text"
        maxLength={500}
        value={question}
        error={error}
        onChange={(event) => setQuestion(event.target.value)}
      />
      <Button type="submit">{t("ask")}</Button>
    </form>
  );
}
