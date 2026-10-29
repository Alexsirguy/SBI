import type { Lesson } from "@sbi/contracts";
import { LlmError } from "@sbi/llm";
import type { CheckReport } from "./checks";
import { isReusable } from "./invalidation";
import type { TaxonomyLessonLookup } from "./lesson-repository";

export interface FallbackQuery {
  /** The requested entry, then its category: the most specific lesson that exists wins. */
  taxonomyIds: string[];
  locale: Lesson["locale"];
  safetyClass: Lesson["safetyClass"];
  audience: Lesson["audience"][number];
  policyVersion: string;
}

export type PipelineOutcome =
  | { kind: "fresh"; lesson: Lesson; report: CheckReport }
  | { kind: "fallback"; lesson: Lesson; reason: string }
  | { kind: "retry"; reason: string };

export type GenerationAttempt = () => Promise<{ lesson: Lesson; report: CheckReport }>;

function failureKind(error: LlmError): string {
  if (/timed out after/.test(error.message)) return "The language model timed out";
  if (/invalid structured output|does not conform/.test(error.message)) {
    return "The draft failed validation";
  }
  return "Generation failed";
}

// Fallbacks must have passed automated checks; failed drafts never stand in.
function fallbackLesson(candidates: Lesson[], query: FallbackQuery): Lesson | undefined {
  return (
    candidates
      .filter((lesson) => isReusable(lesson))
      // Private lessons may hold another learner's context, so only shared ones stand in.
      .filter((lesson) => lesson.reuse.cacheScope === "shared")
      .filter((lesson) => lesson.safetyClass === query.safetyClass)
      .filter(
        (lesson) => lesson.reviewStatus === "approved" || lesson.reviewStatus === "auto-validated",
      )
      .filter((lesson) => lesson.locale === query.locale)
      .filter((lesson) => lesson.audience.length === 1 && lesson.audience[0] === query.audience)
      .filter((lesson) => lesson.reuse.policyVersion === query.policyVersion)
      .sort((left, right) => right.version - left.version)
      .at(0)
  );
}

// A fallback is always labelled as one; an ungated answer never passes as validated.
export async function runWithFallback(
  lessons: TaxonomyLessonLookup,
  attempt: GenerationAttempt,
  fallback: FallbackQuery,
): Promise<PipelineOutcome> {
  let failure: string;
  try {
    const { lesson, report } = await attempt();
    if (report.passed) return { kind: "fresh", lesson, report };
    const failed = report.results.filter((item) => !item.passed).map((item) => item.name);
    failure = `Automated checks failed: ${failed.join(", ")}`;
  } catch (error) {
    if (!(error instanceof LlmError)) throw error;
    failure = failureKind(error);
  }
  let standby: Lesson | undefined;
  for (const taxonomyId of fallback.taxonomyIds) {
    standby = fallbackLesson(await lessons.findByTaxonomy(taxonomyId), fallback);
    if (standby) break;
  }
  if (standby) {
    return {
      kind: "fallback",
      lesson: standby,
      reason: `${failure}; serving a related cached lesson instead`,
    };
  }
  return { kind: "retry", reason: `${failure}; try again` };
}
