import type { Lesson } from "./lesson";
import type { VisualManifest } from "./visual";

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
  const content: Record<string, unknown> = Object.fromEntries(
    CONTENT_FIELDS.map((field) => [field, lesson[field]]),
  );
  // Re-verifying a claim changes its audit trail, not what the learner reads.
  content.claims = lesson.claims.map(({ verification: _verification, ...claim }) => claim);
  return sha256Hex(canonicalJson(content));
}

/** SHA-256 of a visual's manifest, so a stored or served copy can be checked against the register. */
export function visualManifestHash(manifest: VisualManifest): Promise<string> {
  return sha256Hex(canonicalJson(manifest));
}

/** Lowercase hex SHA-256 of a text, as the rights register records checksums. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
