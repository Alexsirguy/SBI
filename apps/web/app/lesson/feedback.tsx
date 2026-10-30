"use client";

import type { ApiRequest, FeedbackCategory } from "@sbi/contracts";
import { useMutation } from "@tanstack/react-query";
import { Button, Notice, Scale, SelectField, TextArea } from "@sbi/ui";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { ApiRequestError, UNREACHABLE } from "../api-client";

export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  "wrong-fact": "Something is wrong",
  unclear: "Hard to understand",
  unsafe: "Could be unsafe",
  "missing-source": "Needs a source",
  offensive: "Offensive or upsetting",
  other: "Something else",
};

const SCALE_WORDS = {
  1: "Not at all",
  2: "A little",
  3: "Somewhat",
  4: "Mostly",
  5: "Very",
} as const;

function useSubmitFeedback() {
  return useMutation({
    mutationFn: (request: ApiRequest<"submitLessonFeedback">) =>
      api("submitLessonFeedback", request),
  });
}

const failure = (error: unknown) =>
  error instanceof ApiRequestError ? error.message : UNREACHABLE;

/** Rating and problem reports for this exact lesson version, so triage sees what the learner read. */
export function LessonFeedback({ lessonId, version }: { lessonId: string; version: number }) {
  const rating = useSubmitFeedback();
  const report = useSubmitFeedback();
  const [helpful, setHelpful] = useState<number>();
  const [clear, setClear] = useState<number>();
  const [category, setCategory] = useState<FeedbackCategory | "">("");
  const [details, setDetails] = useState("");
  const [missing, setMissing] = useState<string>();
  const ratedRef = useRef<HTMLParagraphElement>(null);
  const reportedRef = useRef<HTMLParagraphElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  // The sent form goes away with its focused button, so focus moves to the confirmation instead.
  useEffect(() => {
    if (rating.isSuccess) ratedRef.current?.focus();
  }, [rating.isSuccess]);
  useEffect(() => {
    if (report.isSuccess) reportedRef.current?.focus();
  }, [report.isSuccess]);

  return (
    <section aria-labelledby="feedback-heading" className="lesson-feedback">
      <h2 id="feedback-heading">Tell us what you think</h2>

      {rating.isSuccess ? (
        <p ref={ratedRef} tabIndex={-1} role="status">
          Thanks for rating this lesson.
        </p>
      ) : (
        <form
          aria-label="Rate this lesson"
          onSubmit={(event) => {
            event.preventDefault();
            if (helpful && clear) rating.mutate({ lessonId, version, rating: { helpful, clear } });
          }}
        >
          <Scale
            legend="How helpful was it?"
            name="helpful"
            value={helpful}
            onChange={setHelpful}
            words={SCALE_WORDS}
          />
          <Scale
            legend="How clear was it?"
            name="clear"
            value={clear}
            onChange={setClear}
            words={SCALE_WORDS}
          />
          <Button type="submit" disabled={!helpful || !clear || rating.isPending}>
            Send rating
          </Button>
          {rating.isError ? (
            <Notice kind="error" live>
              {failure(rating.error)}
            </Notice>
          ) : null}
        </form>
      )}

      {report.isSuccess ? (
        <p ref={reportedRef} tabIndex={-1} role="status">
          Thanks. A reviewer will look at this lesson.
        </p>
      ) : (
        <form
          aria-label="Report a problem"
          onSubmit={(event) => {
            event.preventDefault();
            if (!category) {
              setMissing("Choose what kind of problem it is.");
              categoryRef.current?.focus();
              return;
            }
            setMissing(undefined);
            report.mutate({
              lessonId,
              version,
              report: { category, ...(details.trim() ? { details: details.trim() } : {}) },
            });
          }}
        >
          <h3>Report a problem</h3>
          <SelectField
            ref={categoryRef}
            label="What is wrong?"
            value={category}
            error={missing}
            onChange={(event) => setCategory(event.target.value as FeedbackCategory | "")}
          >
            <option value="">Choose one</option>
            {(Object.keys(CATEGORY_LABELS) as FeedbackCategory[]).map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </option>
            ))}
          </SelectField>
          <TextArea
            label="Details (optional)"
            rows={3}
            maxLength={1000}
            value={details}
            hint="Please leave out your name or other personal details."
            onChange={(event) => setDetails(event.target.value)}
          />
          <Button type="submit" disabled={report.isPending}>
            Send report
          </Button>
          {report.isError ? (
            <Notice kind="error" live>
              {failure(report.error)}
            </Notice>
          ) : null}
        </form>
      )}
    </section>
  );
}
