"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { format } from "./format";
import { DEFAULT_LOCALE, type Locale } from "./locales";
import type { Messages, Namespace } from "./messages";

interface I18n {
  locale: Locale;
  messages: Messages;
}

// Unit tests set this to English once (test-setup.ts); pages always get the provider's.
let fallback: I18n | undefined;
export function setFallbackMessages(messages: Messages) {
  fallback = { locale: DEFAULT_LOCALE, messages };
}

const I18nContext = createContext<I18n | undefined>(undefined);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  return <I18nContext.Provider value={{ locale, messages }}>{children}</I18nContext.Provider>;
}

function useI18n(): I18n {
  const i18n = useContext(I18nContext) ?? fallback;
  if (!i18n) throw new Error("useT needs an I18nProvider above it.");
  return i18n;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

/** A translator for one namespace: `t("key", { name: "value" })`. */
export function useT<N extends Namespace>(namespace: N) {
  const { messages } = useI18n();
  const table = messages[namespace];
  return useCallback(
    (key: keyof Messages[N] & string, values?: Record<string, string | number>) =>
      format(table[key as keyof typeof table] as string, values),
    [table],
  );
}
