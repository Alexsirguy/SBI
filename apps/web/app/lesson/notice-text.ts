import type { LessonDisclaimer } from "@sbi/contracts";
import type { LessonT } from "./lesson-t";

// Every doubt about sourcing reads the same to a learner, so they share one clause.
const NOT_BACKED = new Set<LessonDisclaimer["kind"]>([
  "unverified-sections",
  "sources-disagree",
  "open-questions",
  "limited-evidence",
]);

/** The one caution a lesson shows, written as a single paragraph however many doubts it has. */
export function cautionText(items: LessonDisclaimer[], t: LessonT): string | undefined {
  const kinds = new Set(items.map((item) => item.kind));
  kinds.delete("safety");
  // A teacher's edits are said first and on their own; they aren't a doubt about the sources.
  const teacher = kinds.delete("teacher-edited") ? t("cautionTeacherEdited") : undefined;
  if (kinds.size === 0) return teacher;
  const model = kinds.has("model-knowledge");
  const notBacked = [...kinds].some((kind) => NOT_BACKED.has(kind));
  const parts =
    model && notBacked
      ? t("cautionBoth")
      : model
        ? t("cautionModelKnowledge")
        : notBacked
          ? t("cautionNotBacked")
          : undefined;
  const sentences = [
    ...(teacher ? [teacher] : []),
    ...(parts ? [parts] : []),
    ...(kinds.has("reading-level") ? [t("cautionReadingLevel")] : []),
    parts ? t("cautionReviewIt") : t("cautionReviewLesson"),
  ];
  return sentences.join(" ");
}
