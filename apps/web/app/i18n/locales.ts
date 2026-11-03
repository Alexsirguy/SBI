export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "sbi_locale";

/** Each language named in itself, so a learner can find their own in the switcher. */
export const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", es: "Español" };

/** Formatting locales for dates and numbers. */
export const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", es: "es-ES" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** The first supported language in an Accept-Language header, by preference order. */
export function localeFromHeader(header: string | null | undefined): Locale {
  const ranked = (header ?? "")
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.find((param) => param.trim().startsWith("q="));
      return {
        language: tag.toLowerCase().split("-")[0] ?? "",
        q: q ? Number(q.split("=")[1]) : 1,
      };
    })
    .filter((entry) => entry.language && entry.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked.map((entry) => entry.language).find(isLocale) ?? DEFAULT_LOCALE;
}
