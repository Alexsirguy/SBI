// Names that suggest a learner's words, a photo or where they are (spec §12), at any depth.
const FORBIDDEN_KEY =
  /(text|question|answer|message|prompt|query|image|photo|face|email|name|address|ip|lat|lng|lon|latitude|longitude|location|geo|url|referrer)$/i;
const MAX_STRING = 80;
const BLOB = /^data:|[A-Za-z0-9+/]{60,}={0,2}$/;

/** Problems that would let sensitive data out; empty when the payload is safe to send. */
export function payloadProblems(value: unknown, path = ""): string[] {
  if (typeof value === "string") {
    if (value.length > MAX_STRING) return [`${path || "value"} is longer than ${MAX_STRING}`];
    if (BLOB.test(value)) return [`${path || "value"} looks like encoded data`];
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => payloadProblems(item, `${path}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => {
      const at = path ? `${path}.${key}` : key;
      // Ids like "lessonId" or "taxonomyId" are fine; the suffix check skips them.
      const named = FORBIDDEN_KEY.test(key) && !/Id$/.test(key) ? [`${at} is not allowed`] : [];
      return [...named, ...payloadProblems(item, at)];
    });
  }
  return [];
}
