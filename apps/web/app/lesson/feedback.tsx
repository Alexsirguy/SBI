"use client";

import type { ApiRequest, FeedbackCategory } from "@sbi/contracts";
import { useMutation } from "@tanstack/react-query";
import { Button, Notice, Scale, SelectField, TextArea } from "@sbi/ui";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { ApiRequestError, UNREACHABLE } from "../api-client";
import { track } from "../analytics/track";
import { useT } from "../i18n/provider";
import { type LessonKey, useErrorText } from "./lesson-t";

export const CATEGORY_KEYS: Record<FeedbackCategory, LessonKey> = {
  "wrong-fact": "categoryWrongFact",
  unclear: "categoryUnclear",
  unsafe: "categoryUnsafe",
  "missing-source": "categoryMissingSource",
  offensive: "categoryOffensive",
  other: "categoryOther",
};

function useSubmitFeedback() {
  return useMutation({
    mutationFn: (request: ApiRequest<"submitLessonFeedback">) =>
      api("submitLessonFeedback", request),
  });
}

const failure = (error: unknown) =>
  error instanceof ApiRequestError ? error.message : UNREACHABLE;

/** Rating and problem reports for this exact lesson version, so triage sees what the learner read. */
export function LessonFeedback({
  lessonId,
  version,
  topic,
}: {
  lessonId: string;
  version: number;
  /** For reporting clarity per topic (#81); see `topicOf`. */
  topic?: string;
}) {
  const t = useT("lesson");
  const errorText = useErrorText();
  const scaleWords = {
    1: t("scaleNotAtAll"),
    2: t("scaleALittle"),
    3: t("scaleSomewhat"),
    4: t("scaleMostly"),
    5: t("scaleVery"),
  };
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
      <h2 id="feedback-heading">{t("feedbackHeading")}</h2>

      {rating.isSuccess ? (
        <p ref={ratedRef} tabIndex={-1} role="status">
          {t("ratingThanks")}
        </p>
      ) : (
        <form
          aria-label={t("rateForm")}
          onSubmit={(event) => {
            event.preventDefault();
            if (helpful && clear) {
              rating.mutate(
                { lessonId, version, rating: { helpful, clear } },
                {
                  onSuccess: () =>
                    track("lesson_rated", { lessonId, version, topic, helpful, clear }),
                },
              );
            }
          }}
        >
          <Scale
            legend={t("helpfulLegend")}
            name="helpful"
            value={helpful}
            onChange={setHelpful}
            words={scaleWords}
          />
          <Scale
            legend={t("clearLegend")}
            name="clear"
            value={clear}
            onChange={setClear}
            words={scaleWords}
          />
          <Button type="submit" disabled={!helpful || !clear || rating.isPending}>
            {t("sendRating")}
          </Button>
          {rating.isError ? (
            <Notice kind="error" label={t("noticeProblem")} live>
              {errorText(failure(rating.error))}
            </Notice>
          ) : null}
        </form>
      )}

      {report.isSuccess ? (
        <p ref={reportedRef} tabIndex={-1} role="status">
          {t("reportThanks")}
        </p>
      ) : (
        <form
          aria-label={t("reportProblem")}
          onSubmit={(event) => {
            event.preventDefault();
            if (!category) {
              setMissing(t("reportMissingCategory"));
              categoryRef.current?.focus();
              return;
            }
            setMissing(undefined);
            report.mutate(
              {
                lessonId,
                version,
                report: { category, ...(details.trim() ? { details: details.trim() } : {}) },
              },
              // The category only: whatever the learner typed stays out of usage statistics.
              { onSuccess: () => track("issue_reported", { lessonId, version, category }) },
            );
          }}
        >
          <h3>{t("reportProblem")}</h3>
          <SelectField
            ref={categoryRef}
            label={t("reportWhatWrong")}
            value={category}
            error={missing}
            onChange={(event) => setCategory(event.target.value as FeedbackCategory | "")}
          >
            <option value="">{t("chooseOne")}</option>
            {(Object.keys(CATEGORY_KEYS) as FeedbackCategory[]).map((key) => (
              <option key={key} value={key}>
                {t(CATEGORY_KEYS[key])}
              </option>
            ))}
          </SelectField>
          <TextArea
            label={t("detailsLabel")}
            rows={3}
            maxLength={1000}
            value={details}
            hint={t("detailsHint")}
            onChange={(event) => setDetails(event.target.value)}
          />
          <Button type="submit" disabled={report.isPending}>
            {t("sendReport")}
          </Button>
          {report.isError ? (
            <Notice kind="error" label={t("noticeProblem")} live>
              {errorText(failure(report.error))}
            </Notice>
          ) : null}
        </form>
      )}
    </section>
  );
}
