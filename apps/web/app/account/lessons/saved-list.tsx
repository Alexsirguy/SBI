"use client";

import { Button } from "@sbi/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { INTL_LOCALE } from "../../i18n/locales";
import { useLocale, useT } from "../../i18n/provider";
import { useAccount } from "../use-account";
import { useRemoveSavedLesson, useSavedLessons } from "../use-saved-lessons";
import { useErrorText } from "../../i18n/error-text";

export function SavedList() {
  const errorText = useErrorText();
  const t = useT("account");
  const locale = useLocale();
  const date = useMemo(
    () => new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "medium" }),
    [locale],
  );
  const router = useRouter();
  const account = useAccount();
  const saved = useSavedLessons(!!account.data);
  const remove = useRemoveSavedLesson();

  useEffect(() => {
    if (account.data === null) router.replace("/account/sign-in?next=%2Faccount%2Flessons");
  }, [account.data, router]);

  if (!account.data || saved.isPending) return <p role="status">{t("savedLoading")}</p>;
  if (saved.error) return <p role="alert">{errorText(saved.error.message)}</p>;
  if (saved.data.length === 0) {
    return (
      <p>
        {t("savedEmptyStart")} <strong>{t("savedEmptyButtonName")}</strong> {t("savedEmptyEnd")}{" "}
        <Link href="/capture">{t("startLesson")}</Link>
      </p>
    );
  }
  return (
    <>
      <ul className="saved-list">
        {saved.data.map((item) => (
          <li key={item.lessonId}>
            <Link href={`/lesson/saved?id=${item.lessonId}`}>{item.title}</Link>
            <span className="saved-list__date">
              {t(item.sharedAt ? "savedOnShared" : "savedOn", {
                date: date.format(new Date(item.savedAt)),
              })}
            </span>
            <Button
              variant="quiet"
              size="small"
              disabled={remove.isPending}
              onClick={() => remove.mutate(item.lessonId)}
            >
              {t("savedRemove")}
              <span className="sbi-visually-hidden"> {item.title}</span>
            </Button>
          </li>
        ))}
      </ul>
      <div role="status">{remove.isSuccess ? <p>{t("savedRemoved")}</p> : null}</div>
      {remove.error ? <p role="alert">{errorText(remove.error.message)}</p> : null}
    </>
  );
}
