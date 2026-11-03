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
  if (kinds.size === 0) return undefined;
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
    ...(parts ? [parts] : []),
    ...(kinds.has("reading-level") ? [t("cautionReadingLevel")] : []),
    parts ? t("cautionReviewIt") : t("cautionReviewLesson"),
  ];
  return sentences.join(" ");
}
