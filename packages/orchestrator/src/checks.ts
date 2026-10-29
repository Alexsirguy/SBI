import { Lesson } from "@sbi/contracts";
import { transitionLesson, type PublishAuditSink } from "./publish";

export interface CheckResult {
  name: string;
  passed: boolean;
  /** Findings, plus notes such as skipped sections; empty on a clean pass. */
  details: string[];
}

/** One automated lesson validation; checks run independently and in parallel. */
export interface LessonCheck {
  readonly name: string;
  run(lesson: Lesson, options?: { signal?: AbortSignal }): Promise<CheckResult>;
}

export interface CheckReport {
  lessonId: string;
  version: number;
  passed: boolean;
  results: CheckResult[];
  checkedAt: string;
}

function result(name: string, details: string[]): CheckResult {
  return { name, passed: details.length === 0, details };
}

/** The Lesson schema is the conformance gate; everything else assumes it holds. */
export const schemaCheck: LessonCheck = {
  name: "schema",
  async run(lesson) {
    const parsed = Lesson.safeParse(lesson);
    if (parsed.success) return result(schemaCheck.name, []);
    return result(
      schemaCheck.name,
      parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`),
    );
  },
};

/** Every cited claim must exist, and every stored claim must be cited somewhere. */
export const citationCheck: LessonCheck = {
  name: "citations",
  async run(lesson) {
    const known = new Set(lesson.claims.map((claim) => claim.claimId));
    const cited = new Set(lesson.sections.flatMap((section) => section.claimIds));
    const details = [
      ...[...cited].filter((id) => !known.has(id)).map((id) => `Unknown claim "${id}"`),
      ...[...known].filter((id) => !cited.has(id)).map((id) => `Claim "${id}" is never cited`),
    ];
    return result(citationCheck.name, details);
  },
};

// Lessons leaning on unsettled claims must name the misconception risk for learners.
export const misconceptionCheck: LessonCheck = {
  name: "misconceptions",
  async run(lesson) {
    const unsettled = lesson.claims.some(
      (claim) => claim.status === "disputed" || claim.status === "unsupported",
    );
    if (!unsettled || lesson.misconceptionNotes.length > 0) {
      return result(misconceptionCheck.name, []);
    }
    return result(misconceptionCheck.name, [
      "Lesson cites unsettled claims but names no misconceptions",
    ]);
  },
};

interface RunOptions {
  signal?: AbortSignal;
  onAudit?: PublishAuditSink;
}

// Only the generated -> auto-validated step lives here; review routing is E6-6.
export async function runLessonChecks(
  lesson: Lesson,
  checks: LessonCheck[],
  options?: RunOptions,
): Promise<{ lesson: Lesson; report: CheckReport }> {
  const results = await Promise.all(
    checks.map((check) => check.run(lesson, { signal: options?.signal })),
  );
  const checkedAt = new Date().toISOString();
  const passed = results.every((item) => item.passed);
  const report: CheckReport = {
    lessonId: lesson.lessonId,
    version: lesson.version,
    passed,
    results,
    checkedAt,
  };
  if (!passed || lesson.reviewStatus !== "generated") return { lesson, report };
  const moved = transitionLesson(lesson, "auto-validated", { by: "system", at: checkedAt });
  options?.onAudit?.(moved.audit);
  return {
    lesson: { ...moved.lesson, reuse: { ...moved.lesson.reuse, validatedAt: checkedAt } },
    report,
  };
}
