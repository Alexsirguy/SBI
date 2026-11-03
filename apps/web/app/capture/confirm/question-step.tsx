"use client";

import { fixedQuestions } from "@sbi/contracts";
import { Button, TextField } from "@sbi/ui";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { useLocale, useT } from "../../i18n/provider";
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
  const t = useT("capture");
  const locale = useLocale();
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [own, setOwn] = useState("");
  const [error, setError] = useState<string>();
  const prefs = readPrefs() ?? DEFAULT_PREFS;
  const audience = prefs.age === "none" ? "general" : prefs.age;
  const readingLevel = DEPTHS[prefs.depth].readingLevel;
  const suggested = useQuery({
    queryKey: ["suggestQuestions", label, audience, readingLevel, locale],
    queryFn: () => api("suggestQuestions", { subject: label, audience, readingLevel, locale }),
    staleTime: Infinity,
    retry: false,
  });
  // A failed request still leaves questions to pick, the same ones the API stands in.
  const questions = suggested.isError ? fixedQuestions(label, locale) : suggested.data?.questions;
  const name = label.toLowerCase();

  useEffect(() => headingRef.current?.focus(), []);

  function start(question: string) {
    onStart(label);
    router.push(lessonHref({ label }, { question, prefs }));
  }

  return (
    <section aria-labelledby="questions-heading" className="photo-choices photo-questions">
      <h2 id="questions-heading" ref={headingRef} tabIndex={-1}>
        {t("questionHeading", { name })}
      </h2>
      {questions ? (
        <ul className="choice-list" aria-label={t("questionsLabel")}>
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
          {t("findingQuestions", { name })}
        </p>
      )}
      <form
        className="describe-form"
        aria-label={t("ownQuestionForm")}
        onSubmit={(event) => {
          event.preventDefault();
          const question = own.trim().replace(/\s+/g, " ");
          if (question.length < MIN_QUESTION) {
            setError(t("minQuestion", { count: MIN_QUESTION }));
            inputRef.current?.focus();
            return;
          }
          setError(undefined);
          start(question);
        }}
      >
        <TextField
          ref={inputRef}
          label={t("ownQuestionLabel")}
          name="own-question"
          autoComplete="off"
          maxLength={500}
          value={own}
          error={error}
          onChange={(event) => setOwn(event.target.value)}
        />
        <Button type="submit">{t("ask")}</Button>
      </form>
      <button type="button" className="back-link" onClick={onBack}>
        {t("notThisChooseAgain", { name })}
      </button>
    </section>
  );
}
