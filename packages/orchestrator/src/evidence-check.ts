import type { EvidenceSource } from "@sbi/contracts";
import { checkSourcePolicy, type CitationResolver } from "@sbi/evidence";
import type { LessonCheck } from "./checks";

export interface EvidenceCheckDeps {
  resolver: CitationResolver;
  sources: (sourceIds: string[]) => Promise<EvidenceSource[]>;
}

/** Claims must match the stored graph, resolve to fresh excerpts and meet the two-source policy. */
export function createEvidenceCheck(deps: EvidenceCheckDeps): LessonCheck {
  return {
    name: "evidence",
    async run(lesson) {
      const problems = await deps.resolver.checkLesson(lesson);
      const sources = await deps.sources([
        ...new Set(lesson.claims.flatMap((claim) => claim.sourceIds)),
      ]);
      const issues = checkSourcePolicy(lesson.claims, sources);
      const details = [
        ...problems.map((problem) => `${problem.kind}: ${JSON.stringify(problem)}`),
        ...issues.map((issue) => `${issue.kind}: claim ${issue.claimId}`),
      ];
      return { name: "evidence", passed: details.length === 0, details };
    },
  };
}
