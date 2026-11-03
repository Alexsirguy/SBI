import "server-only";
import { cookies, headers } from "next/headers";
import { isLocale, LOCALE_COOKIE, localeFromHeader, type Locale } from "./locales";
import type { Messages } from "./messages";

/** The learner's chosen language, else their browser's, else English. */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return localeFromHeader((await headers()).get("accept-language"));
}

// Loaded on the server only, so a page never ships every language in its JavaScript.
export async function getMessages(locale: Locale): Promise<Messages> {
  return locale === "es"
    ? (await import("./messages/es")).default
    : (await import("./messages/en")).default;
}
