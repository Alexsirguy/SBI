import { createHash } from "node:crypto";
import type { Lesson } from "@sbi/contracts";

export interface IntentInput {
  question: string;
  /** Confirmed taxonomy category id. */
  taxonomyId: string;
  conceptIds: string[];
  /** Depth is audience plus reading level; both change what the lesson teaches. */
  audience: Lesson["audience"][number];
  readingLevel: Lesson["readingLevel"];
  locale: Lesson["locale"];
  safetyScope: Lesson["safetyClass"];
}

// Normalised before hashing so trivial rephrasings reuse the same lesson.
export function buildIntentSignature(input: IntentInput): string {
  const normalised = {
    question: input.question.trim().replace(/\s+/g, " ").toLowerCase(),
    taxonomyId: input.taxonomyId.trim(),
    conceptIds: [...new Set(input.conceptIds.map((id) => id.trim()))].sort(),
    audience: input.audience,
    readingLevel: input.readingLevel,
    locale: input.locale.trim(),
    safetyScope: input.safetyScope,
  };
  return createHash("sha256").update(JSON.stringify(normalised)).digest("hex");
}
