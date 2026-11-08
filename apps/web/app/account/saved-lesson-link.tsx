"use client";

import type { ApiResponse } from "@sbi/contracts";
import Link from "next/link";
import { useMemo } from "react";
import { INTL_LOCALE } from "../i18n/locales";
import { useLocale, useT } from "../i18n/provider";

/** A saved lesson's title and date, shared by the dashboard and the full list. */
export function SavedLessonLink({
  item,
}: {
  item: ApiResponse<"savedLessons">["lessons"][number];
}) {
  const t = useT("account");
  const locale = useLocale();
  const date = useMemo(
    () => new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "medium" }),
    [locale],
  );
  return (
    <>
      <Link href={`/lesson/saved?id=${item.lessonId}`}>{item.title}</Link>
      <span className="saved-list__date">
        {t(item.sharedAt ? "savedOnShared" : "savedOn", {
          date: date.format(new Date(item.savedAt)),
        })}
      </span>
    </>
  );
}
