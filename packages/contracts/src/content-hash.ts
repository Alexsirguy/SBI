import type { Lesson } from "./lesson";

// Review state and reuse metadata are excluded so only content changes alter the hash.
const CONTENT_FIELDS = [
  "taxonomyId",
  "title",
  "locale",
  "audience",
  "readingLevel",
  "summary",
  "learningObjectives",
  "assumptions",
  "concepts",
  "misconceptionNotes",
  "sections",
  "claims",
  "visuals",
  "safetyClass",
] as const satisfies readonly (keyof Lesson)[];

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** SHA-256 of a lesson's learner-facing content; equal content gives equal hashes. */
export async function lessonContentHash(lesson: Lesson): Promise<string> {
  const content = Object.fromEntries(CONTENT_FIELDS.map((field) => [field, lesson[field]]));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson(content)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
