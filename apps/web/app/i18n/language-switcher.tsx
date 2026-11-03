"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import { LANGUAGE_NAMES, LOCALE_COOKIE, LOCALES, type Locale } from "./locales";
import { useLocale, useT } from "./provider";

const YEAR_SECONDS = 365 * 24 * 60 * 60;

/** Remembered in a cookie so the server renders the next page in the chosen language. */
export function LanguageSwitcher() {
  const t = useT("common");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();

  const choose = (next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${YEAR_SECONDS}; SameSite=Lax`;
    router.refresh();
  };

  return (
    <div className="language-switcher">
      <label htmlFor={id}>{t("language")}</label>
      <select id={id} value={locale} onChange={(event) => choose(event.target.value as Locale)}>
        {LOCALES.map((option) => (
          <option key={option} value={option} lang={option}>
            {LANGUAGE_NAMES[option]}
          </option>
        ))}
      </select>
    </div>
  );
}
