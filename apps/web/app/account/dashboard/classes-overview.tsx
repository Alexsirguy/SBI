"use client";

import type { TeacherClass } from "@sbi/contracts";
import { Button } from "@sbi/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../api";
import { useErrorText } from "../../i18n/error-text";
import { useT } from "../../i18n/provider";
import { CodePanel, CreateClass, type ShownCode } from "../../teach/teach-home";
import { CLASSES_KEY, useClasses } from "../../teach/use-classes";

/** The latest week's lesson count, from the same counts-only summary as /teach (#117). */
function LatestWeek({ classId }: { classId: string }) {
  const t = useT("teach");
  // Same key as the /teach table, so the two share one request.
  const summary = useQuery({
    queryFn: () => api("classSummary", { classId }),
    queryKey: [...CLASSES_KEY, "summary", classId],
    retry: false,
  });
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

function ClassRow({ item }: { item: TeacherClass }) {
  const t = useT("teach");
  return (
    <li className="account-classes__row">
      <span className="account-classes__name">{item.name}</span>
      <span className="account-classes__meta">
        <span>{t("codeHint", { hint: item.codeHint })}</span>
        <span>
          {item.lessons.length === 1
            ? t("dashLessonOne")
            : t("dashLessonOther", { count: item.lessons.length })}
        </span>
        <LatestWeek classId={item.classId} />
      </span>
    </li>
  );
}

/** Classes at a glance; every control stays on /teach so there is one place to change them. */
export function ClassesOverview() {
  const t = useT("teach");
  const errorText = useErrorText();
  const classes = useClasses(true);
  const [creating, setCreating] = useState(false);
  const [shown, setShown] = useState<ShownCode>();
  const open = classes.data?.classes.filter((item) => !item.archivedAt) ?? [];

  return (
    <>
      {shown ? <CodePanel shown={shown} onDone={() => setShown(undefined)} /> : null}
      <section className="account-card account-classes" aria-labelledby="account-classes">
        <div className="account-classes__head">
          <h2 id="account-classes">{t("accountCardLink")}</h2>
          <Button
            variant="quiet"
            size="small"
            aria-expanded={creating}
            onClick={() => setCreating(!creating)}
          >
            {t("dashNewClass")}
          </Button>
        </div>
        {classes.isPending ? (
          <p role="status">{t("checking")}</p>
        ) : classes.error ? (
          <p role="alert">{errorText(classes.error.message)}</p>
        ) : open.length === 0 ? (
          <p>{t("noClasses")}</p>
        ) : (
          <ul className="account-classes__list">
            {open.map((item) => (
              <ClassRow key={item.classId} item={item} />
            ))}
          </ul>
        )}
        <Link href="/teach" className="account-card__row">
          {t("dashManage")}
        </Link>
      </section>
      {creating ? (
        <CreateClass
          onCreated={(created) => {
            setCreating(false);
            setShown(created);
          }}
        />
      ) : null}
    </>
  );
}
