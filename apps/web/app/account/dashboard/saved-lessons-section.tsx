"use client";

import Link from "next/link";
import { useErrorText } from "../../i18n/error-text";
import { useT } from "../../i18n/provider";
import { SavedLessonLink } from "../saved-lesson-link";
import { useSavedLessons } from "../use-saved-lessons";

const SHOWN = 5;

/** The latest few saved lessons; the full list, with removing, stays on /account/lessons. */
export function SavedLessonsSection({ educator }: { educator: boolean }) {
  const t = useT("account");
  const errorText = useErrorText();
  const saved = useSavedLessons(true);

  return (
    <section className="account-card account-dash__saved" aria-labelledby="account-saved">
      <h2 id="account-saved">{t("accountSavedHeading")}</h2>
      {saved.isPending ? (
        <p role="status">{t("savedLoading")}</p>
      ) : saved.error ? (
        <p role="alert">{errorText(saved.error.message)}</p>
      ) : saved.data.length === 0 ? (
        <p>
          {t("savedEmptyStart")} <strong>{t("savedEmptyButtonName")}</strong> {t("savedEmptyEnd")}{" "}
          <Link href="/capture">{t("startLesson")}</Link>
        </p>
      ) : (
        <>
          <ul className="saved-list">
            {saved.data.slice(0, SHOWN).map((item) => (
              <li key={item.lessonId}>
                <SavedLessonLink item={item} />
                {educator ? (
                  <Link
                    href={`/lesson/saved/edit?id=${item.lessonId}`}
                    className="saved-list__edit"
                  >
                    {t("dashEdit")}
                    <span className="sbi-visually-hidden"> {item.title}</span>
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
          <Link href="/account/lessons" className="account-card__row">
            {saved.data.length > SHOWN
              ? t("dashSeeAllCount", { count: saved.data.length })
              : t("accountSeeSaved")}
          </Link>
        </>
      )}
    </section>
  );
}
