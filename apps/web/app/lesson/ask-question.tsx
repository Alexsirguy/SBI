"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { lessonHref } from "./lesson-request";
import type { LessonPrefs } from "./prefs";

/** Lets the learner ask their own question about the same object, at the same depth. */
export function AskQuestion({
  taxonomyId,
  label,
  prefs,
}: {
  taxonomyId: string;
  label: string;
  prefs: LessonPrefs;
}) {
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string>();
  return (
    <form
      aria-label="Ask your own question"
      className="ask-question"
      onSubmit={(event) => {
        event.preventDefault();
        if (question.trim().length < 3) {
          setError("Write a question of at least 3 characters.");
          inputRef.current?.focus();
          return;
        }
        setError(undefined);
        router.push(lessonHref(taxonomyId, label, { question: question.trim(), prefs }));
      }}
    >
      <label htmlFor={inputId}>Ask your own question about the {label.toLowerCase()}</label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        maxLength={500}
        value={question}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => setQuestion(event.target.value)}
      />
      <button type="submit">Ask</button>
      {error ? (
        <p role="alert" id={errorId}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
