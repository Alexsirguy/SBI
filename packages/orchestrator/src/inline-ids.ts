// Models sometimes cite inline as "[<claim id>]"; learners must never see raw ids.
export function withoutInlineIds(text: string): string {
  return text
    .replace(/\s*[[(]\s*[0-9a-f]{8}-[0-9a-f-]{27}\s*[\])]/gi, "")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}
