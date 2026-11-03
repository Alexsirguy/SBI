/** Spanish for any "es" tag; catalogue text falls back to English for every other language. */
export function isSpanishLabel(locale: string | undefined): boolean {
  return !!locale && /^es(-|$)/i.test(locale);
}
