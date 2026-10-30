"use client";

import type { ApiRequest, FeedbackCategory } from "@sbi/contracts";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
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

const SCALE = [1, 2, 3, 4, 5] as const;
const SCALE_WORDS: Record<(typeof SCALE)[number], string> = {
  1: "Not at all",
  2: "A little",
  3: "Somewhat",
  4: "Mostly",
  5: "Very",
};

function useSubmitFeedback() {
  return useMutation({
    mutationFn: (request: ApiRequest<"submitLessonFeedback">) =>
      api("submitLessonFeedback", request),
  });
}

const failure = (error: unknown) =>
  error instanceof ApiRequestError ? error.message : UNREACHABLE;

function Scale({
  legend,
  name,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      {SCALE.map((point) => (
        <label key={point}>
          <input
            type="radio"
            name={name}
            value={point}
            checked={value === point}
            onChange={() => onChange(point)}
          />
          {point} {SCALE_WORDS[point]}
        </label>
      ))}
    </fieldset>
  );
}

/** Rating and problem reports for this exact lesson version, so triage sees what the learner read. */
export function LessonFeedback({ lessonId, version }: { lessonId: string; version: number }) {
  const rating = useSubmitFeedback();
  const report = useSubmitFeedback();
  const [helpful, setHelpful] = useState<number>();
  const [clear, setClear] = useState<number>();
  const [category, setCategory] = useState<FeedbackCategory | "">("");
  const [details, setDetails] = useState("");
  const [missing, setMissing] = useState<string>();
  const categoryId = useId();
  const detailsId = useId();
  const detailsHintId = useId();
  const reportErrorId = useId();

  return (
    <section aria-labelledby="feedback-heading" className="lesson-feedback">
      <h2 id="feedback-heading">Tell us what you think</h2>

      {rating.isSuccess ? (
        <p role="status">Thanks for rating this lesson.</p>
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
          />
          <Scale legend="How clear was it?" name="clear" value={clear} onChange={setClear} />
          <button type="submit" disabled={!helpful || !clear || rating.isPending}>
            Send rating
          </button>
          {rating.isError ? <p role="alert">{failure(rating.error)}</p> : null}
        </form>
      )}

      {report.isSuccess ? (
        <p role="status">Thanks. A reviewer will look at this lesson.</p>
      ) : (
        <form
          aria-label="Report a problem"
          onSubmit={(event) => {
            event.preventDefault();
            if (!category) {
              setMissing("Choose what kind of problem it is.");
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
          <label htmlFor={categoryId}>What is wrong?</label>
          <select
            id={categoryId}
            value={category}
            aria-invalid={missing ? true : undefined}
            aria-describedby={missing ? reportErrorId : undefined}
            onChange={(event) => setCategory(event.target.value as FeedbackCategory | "")}
          >
            <option value="">Choose one</option>
            {(Object.keys(CATEGORY_LABELS) as FeedbackCategory[]).map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </option>
            ))}
          </select>
          <label htmlFor={detailsId}>Details (optional)</label>
          <textarea
            id={detailsId}
            rows={3}
            maxLength={1000}
            value={details}
            aria-describedby={detailsHintId}
            onChange={(event) => setDetails(event.target.value)}
          />
          <p id={detailsHintId} className="hint">
            Please leave out your name or other personal details.
          </p>
          <button type="submit" disabled={report.isPending}>
            Send report
          </button>
          {missing ? (
            <p role="alert" id={reportErrorId}>
              {missing}
            </p>
          ) : null}
          {report.isError ? <p role="alert">{failure(report.error)}</p> : null}
        </form>
      )}
    </section>
  );
}
