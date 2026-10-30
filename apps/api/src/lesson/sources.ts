import { type EvidenceSource, type Lesson, LessonSources } from "@sbi/contracts";
import { excerptDisplay } from "@sbi/evidence";

/** The sources behind a lesson's cited excerpts, shown only as each licence allows (#181). */
export function lessonSources(lesson: Lesson, stored: EvidenceSource[]): LessonSources {
  const cited = new Map<string, Set<string>>();
  for (const claim of lesson.claims) {
    for (const citation of claim.citations ?? []) {
      cited.set(
        citation.sourceId,
        (cited.get(citation.sourceId) ?? new Set()).add(citation.excerptId),
      );
    }
  }
  const sources = stored
    .filter((source) => cited.has(source.sourceId))
    .map((source) => {
      const excerpts = source.excerpts
        .filter((excerpt) => cited.get(source.sourceId)?.has(excerpt.excerptId))
        .map((excerpt) => {
          const display = excerptDisplay(source, excerpt.text);
          return display.mode === "quote"
            ? {
                excerptId: excerpt.excerptId,
                mode: "quote" as const,
                text: display.text,
                location: excerpt.location,
              }
            : { excerptId: excerpt.excerptId, mode: "link" as const, location: excerpt.location };
        });
      const display = excerptDisplay(source, "");
      return {
        sourceId: source.sourceId,
        title: source.title,
        url: display.url,
        credit: display.credit,
        license: display.license,
        excerpts,
      };
    });
  return LessonSources.parse({ lessonId: lesson.lessonId, sources });
}
