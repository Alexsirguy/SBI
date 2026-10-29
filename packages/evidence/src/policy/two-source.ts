import type { Claim, EvidenceSource } from "@sbi/contracts";

export type PolicyIssue =
  | { kind: "single-source"; claimId: string; independentSources: number }
  | { kind: "missing-limitation"; claimId: string };

export const SINGLE_SOURCE_NOTE = "Only one independent source supports this so far.";
export const SINGLE_STUDY_LIMITATION =
  "This comes from a single study; later research may confirm, refine or overturn it.";
export const STUDIES_LIMITATION =
  "This comes from individual studies rather than a review or reference source, so it may change as research continues.";

const surname = (author: string) =>
  author
    .trim()
    .split(/[\s,]+/)[0]
    ?.toLowerCase() ?? "";

const hostOf = (url: string | undefined) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : undefined;
  } catch {
    return undefined;
  }
};

/** Two sources are not independent if they are the same work, publisher or share an author. */
export function sameOrigin(a: EvidenceSource, b: EvidenceSource): boolean {
  if (a.doi && b.doi) {
    if (a.doi.toLowerCase() === b.doi.toLowerCase()) return true;
    const authors = new Set(a.authors.map(surname));
    // Journals publish many independent papers, so for papers only shared authorship links them.
    return b.authors.some((author) => authors.has(surname(author)));
  }
  const publisherA = a.publisher?.toLowerCase() ?? hostOf(a.url);
  const publisherB = b.publisher?.toLowerCase() ?? hostOf(b.url);
  return publisherA !== undefined && publisherA === publisherB;
}

/** Counts groups of sources that could have reached the claim independently. */
export function independentSourceCount(sources: EvidenceSource[]): number {
  const groups: EvidenceSource[][] = [];
  for (const source of sources) {
    const group = groups.find((members) => members.some((member) => sameOrigin(member, source)));
    if (group) group.push(source);
    else groups.push([source]);
  }
  return groups.length;
}

// Journal articles of unknown design are read as single studies, the cautious reading.
export const isPrimaryStudy = (source: EvidenceSource) =>
  source.studyDesign === "primary-study" ||
  (source.studyDesign === undefined && source.sourceType === "peer-reviewed");

/** The sources a claim actually cites as support, falling back to its listed sources. */
function supportingSources(claim: Claim, byId: Map<string, EvidenceSource>): EvidenceSource[] {
  const ids = claim.citations?.length
    ? claim.citations.map((citation) => citation.sourceId)
    : claim.sourceIds;
  return [...new Set(ids)].flatMap((id) => (byId.has(id) ? [byId.get(id) as EvidenceSource] : []));
}

export interface PolicyAssessment {
  independentSources: number;
  needsSecondSource: boolean;
  limitation?: string;
}

/** What the policy requires of one claim, given the sources it rests on. */
export function assessClaim(claim: Claim, sources: EvidenceSource[]): PolicyAssessment {
  const byId = new Map(sources.map((source) => [source.sourceId, source]));
  const support = supportingSources(claim, byId);
  const independentSources = independentSourceCount(support);
  const shownAsFact = claim.status === "supported" || claim.status === "qualified";
  const studies = support.filter(isPrimaryStudy);
  const restsOnStudies = support.length > 0 && studies.length === support.length;
  return {
    independentSources,
    needsSecondSource: shownAsFact && claim.significance !== "basic" && independentSources < 2,
    limitation: restsOnStudies
      ? studies.length === 1
        ? SINGLE_STUDY_LIMITATION
        : STUDIES_LIMITATION
      : undefined,
  };
}

/** Flags single-sourced non-trivial claims and study-only claims without a limitation note. */
export function checkSourcePolicy(claims: Claim[], sources: EvidenceSource[]): PolicyIssue[] {
  const issues: PolicyIssue[] = [];
  for (const claim of claims) {
    const assessment = assessClaim(claim, sources);
    // A single source is acceptable once the claim says so in its uncertainty note.
    if (assessment.needsSecondSource && claim.status === "supported") {
      issues.push({
        kind: "single-source",
        claimId: claim.claimId,
        independentSources: assessment.independentSources,
      });
    }
    if (assessment.limitation && !claim.limitations) {
      issues.push({ kind: "missing-limitation", claimId: claim.claimId });
    }
  }
  return issues;
}

/** Applies the policy: qualifies single-sourced claims and adds limitation notes for studies. */
export function applySourcePolicy(claim: Claim, sources: EvidenceSource[]): Claim {
  const assessment = assessClaim(claim, sources);
  let next = claim;
  if (assessment.needsSecondSource && claim.status === "supported") {
    next = {
      ...next,
      status: "qualified",
      confidence: "medium",
      uncertainty: next.uncertainty ?? SINGLE_SOURCE_NOTE,
    };
  }
  if (assessment.limitation && !next.limitations) {
    next = { ...next, limitations: assessment.limitation };
  }
  return next;
}
