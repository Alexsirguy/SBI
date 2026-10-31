import type { LessonDisclaimer } from "@sbi/contracts";

// Every doubt about sourcing reads the same to a learner, so they share one clause.
const NOT_BACKED = new Set<LessonDisclaimer["kind"]>([
  "unverified-sections",
  "sources-disagree",
  "open-questions",
  "limited-evidence",
]);

/** The one caution a lesson shows, written as a single paragraph however many doubts it has. */
export function cautionText(items: LessonDisclaimer[]): string | undefined {
  const kinds = new Set(items.map((item) => item.kind));
  kinds.delete("safety");
  if (kinds.size === 0) return undefined;
  const parts = [
    ...(kinds.has("model-knowledge") ? ["come from the AI's general knowledge"] : []),
    ...([...kinds].some((kind) => NOT_BACKED.has(kind))
      ? ["are not fully backed by their sources"]
      : []),
  ];
  const sentences = [
    ...(parts.length > 0 ? [`Some parts of this lesson ${parts.join(" and some ")}.`] : []),
    ...(kinds.has("reading-level") ? ["It may be harder to read than the level you chose."] : []),
    `A reviewer has not checked ${parts.length > 0 ? "it" : "this lesson"} yet, so report anything that looks wrong.`,
  ];
  return sentences.join(" ");
}
