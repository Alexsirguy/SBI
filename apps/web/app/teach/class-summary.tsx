"use client";

import type { ClassSummary } from "@sbi/contracts";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import { api } from "../api";
import { useT } from "../i18n/provider";
import { CLASSES_KEY } from "./use-classes";

const COLUMNS = [
  ["lesson_opened", "summaryLessons"],
  ["check_answered", "summaryChecks"],
  ["check_correct", "summaryCorrect"],
  ["visual_used", "summaryVisuals"],
] as const;

// One key for every view of a class's counts, so the list and the class page share a request.
function useClassSummary(classId: string) {
  return useQuery({
    queryFn: () => api("classSummary", { classId }),
    queryKey: [...CLASSES_KEY, "summary", classId],
    retry: false,
  });
}

/** The latest week's lessons opened, for a one-line glance at a class. */
export function LatestWeek({ classId }: { classId: string }) {
  const t = useT("teach");
  const summary = useClassSummary(classId);
  if (!summary.data) return null;
  const [latest] = summary.data.weeks;
  if (!latest) return <span>{t("dashNoActivity")}</span>;
  const opened = latest.counts.lesson_opened;
  return (
    <span>
      {t("dashWeek", {
        count: opened === null ? t("summaryHidden", { min: summary.data.minCount }) : opened,
        week: latest.week,
      })}
    </span>
  );
}

/** Whole-class weekly counts with small numbers hidden (#117); there is no per-pupil view. */
export function ClassSummaryTable({ classId }: { classId: string }) {
  const t = useT("teach");
  const headingId = useId();
  const summary = useClassSummary(classId);
  const data: ClassSummary | undefined = summary.data;
  if (!data) return null;
  const cell = (value: number | null) =>
    value === null ? t("summaryHidden", { min: data.minCount }) : String(value);

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>{t("summaryHeading")}</h2>
      <p className="account-card__hint">{t("summaryLead", { min: data.minCount })}</p>
      {data.weeks.length === 0 ? (
        <p>{t("summaryEmpty")}</p>
      ) : (
        <div className="teach-summary" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">{t("summaryWeek")}</th>
                {COLUMNS.map(([metric, label]) => (
                  <th key={metric} scope="col">
                    {t(label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.weeks.map((week) => (
                <tr key={week.week}>
                  <th scope="row">{week.week}</th>
                  {COLUMNS.map(([metric]) => (
                    <td key={metric}>{cell(week.counts[metric])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{t("summaryTotal")}</th>
                {COLUMNS.map(([metric]) => (
                  <td key={metric}>{cell(data.totals[metric])}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
