"use client";

import { fixedQuestions } from "@sbi/contracts";
import { Button, TextField } from "@sbi/ui";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { lessonHref } from "../../lesson/lesson-request";
import { DEFAULT_PREFS, DEPTHS, readPrefs } from "../../lesson/prefs";

const MIN_QUESTION = 3;

/** What the learner wants to know about the object, asked before any lesson is written (#325). */
export function QuestionStep({
  label,
  onStart,
  onBack,
}: {
  label: string;
  /** Hands the photo on to the lesson page before it opens. */
  onStart: (label: string) => void;
  onBack: () => void;
}) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [own, setOwn] = useState("");
  const [error, setError] = useState<string>();
  const prefs = readPrefs() ?? DEFAULT_PREFS;
  const audience = prefs.age === "none" ? "general" : prefs.age;
  const readingLevel = DEPTHS[prefs.depth].readingLevel;
  const suggested = useQuery({
    queryKey: ["suggestQuestions", label, audience, readingLevel],
    queryFn: () => api("suggestQuestions", { subject: label, audience, readingLevel }),
    staleTime: Infinity,
    retry: false,
  });
  // A failed request still leaves questions to pick, the same ones the API stands in.
  const questions = suggested.isError ? fixedQuestions(label) : suggested.data?.questions;
  const name = label.toLowerCase();

  useEffect(() => headingRef.current?.focus(), []);

  function start(question: string) {
    onStart(label);
    router.push(lessonHref({ label }, { question, prefs }));
  }

  return (
    <section aria-labelledby="questions-heading" className="photo-choices photo-questions">
      <h2 id="questions-heading" ref={headingRef} tabIndex={-1}>
        What would you like to know about the {name}?
      </h2>
      {questions ? (
        <ul className="choice-list" aria-label="Questions you could ask">
          {questions.map((question) => (
            <li key={question}>
              <button
                type="button"
                className="choice choice--question"
                onClick={() => start(question)}
              >
                {question}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p role="status" className="photo-choices__message">
          Finding questions about the {name}…
        </p>
      )}
      <form
        className="describe-form"
        aria-label="Ask your own question"
        onSubmit={(event) => {
          event.preventDefault();
          const question = own.trim().replace(/\s+/g, " ");
          if (question.length < MIN_QUESTION) {
            setError(`Write a question of at least ${MIN_QUESTION} characters.`);
            inputRef.current?.focus();
            return;
          }
          setError(undefined);
          start(question);
        }}
      >
        <TextField
          ref={inputRef}
          label="Or ask your own question"
          name="own-question"
          autoComplete="off"
          maxLength={500}
          value={own}
          error={error}
          onChange={(event) => setOwn(event.target.value)}
        />
        <Button type="submit">Ask</Button>
      </form>
      <button type="button" className="back-link" onClick={onBack}>
        Not a {name}? Choose again
      </button>
    </section>
  );
}
