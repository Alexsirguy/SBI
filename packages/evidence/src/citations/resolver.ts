import {
  canonicalJson,
  type Claim,
  type EvidenceSource,
  type ExcerptRef,
  type Lesson,
} from "@sbi/contracts";
import type { EvidenceRepositories } from "../claims/persist";
import { comparableText as comparable } from "../retrieval/text";

export type CitationProblem =
  | { kind: "unknown-claim"; claimId: string }
  | { kind: "claim-mismatch"; claimId: string }
  | { kind: "unknown-source"; sourceId: string; claimId?: string }
  | { kind: "unknown-excerpt"; sourceId: string; excerptId: string; claimId?: string }
  | { kind: "source-not-linked"; sourceId: string; claimId: string }
  | { kind: "no-excerpt"; claimId: string }
  | { kind: "quote-not-in-excerpt"; sourceId: string; excerptId: string }
  | { kind: "stale-excerpt"; sourceId: string; excerptId: string; claimId?: string };

export class CitationError extends Error {
  constructor(readonly problems: CitationProblem[]) {
    super(`Citations do not resolve: ${problems.map((problem) => problem.kind).join(", ")}`);
    this.name = "CitationError";
  }
}

export interface ResolvedExcerpt {
  sourceId: string;
  excerptId: string;
  title: string;
  url?: string;
  doi?: string;
  location: string;
  text: string;
  rightsStatus: EvidenceSource["rightsStatus"];
}

export interface ResolvedClaim {
  claim: Claim;
  excerpts: ResolvedExcerpt[];
}

export interface QuotedRef extends ExcerptRef {
  /** Words the caller attributes to the source; they must appear in the stored excerpt. */
  quote?: string;
}

export interface CitationResolver {
  resolveExcerpt(ref: QuotedRef): Promise<ResolvedExcerpt>;
  resolveClaim(claimId: string): Promise<ResolvedClaim>;
  /** Every problem in a lesson's claims, checked against the store rather than the lesson's copy. */
  checkLesson(lesson: Pick<Lesson, "claims">): Promise<CitationProblem[]>;
}

// The freshness check found the source gone or no longer saying these words.
const isStale = (source: EvidenceSource, excerptId: string) =>
  source.freshness?.status === "gone" ||
  (source.freshness?.missingExcerptIds.includes(excerptId) ?? false);

/** Resolves citations only through stored ids, so nothing from model memory can pass as a source. */
export function createCitationResolver(repositories: EvidenceRepositories): CitationResolver {
  const toResolved = (source: EvidenceSource, excerptId: string): ResolvedExcerpt | undefined => {
    const excerpt = source.excerpts.find((item) => item.excerptId === excerptId);
    return excerpt
      ? {
          sourceId: source.sourceId,
          excerptId,
          title: source.title,
          url: source.url,
          doi: source.doi,
          location: excerpt.location,
          text: excerpt.text,
          rightsStatus: source.rightsStatus,
        }
      : undefined;
  };

  async function claimProblems(claim: Claim) {
    const problems: CitationProblem[] = [];
    const excerpts: ResolvedExcerpt[] = [];
    const { claimId } = claim;
    const sources = new Map(
      (await repositories.sources.getMany(claim.sourceIds)).map((source) => [
        source.sourceId,
        source,
      ]),
    );
    for (const sourceId of claim.sourceIds) {
      const source = sources.get(sourceId);
      if (!source) problems.push({ kind: "unknown-source", sourceId, claimId });
      else if (!source.claimIds.includes(claimId)) {
        problems.push({ kind: "source-not-linked", sourceId, claimId });
      }
    }
    for (const { sourceId, excerptId } of claim.citations ?? []) {
      const source = sources.get(sourceId);
      if (!source) continue;
      const resolved = toResolved(source, excerptId);
      if (!resolved) problems.push({ kind: "unknown-excerpt", sourceId, excerptId, claimId });
      else if (isStale(source, excerptId)) {
        problems.push({ kind: "stale-excerpt", sourceId, excerptId, claimId });
      } else excerpts.push(resolved);
    }
    // Anything shown as fact must rest on at least one excerpt we hold, word for word.
    if (claim.status !== "unsupported" && excerpts.length === 0) {
      problems.push({ kind: "no-excerpt", claimId });
    }
    return { problems, excerpts };
  }

  return {
    async resolveExcerpt({ sourceId, excerptId, quote }) {
      const source = await repositories.sources.get(sourceId);
      if (!source) throw new CitationError([{ kind: "unknown-source", sourceId }]);
      const resolved = toResolved(source, excerptId);
      if (!resolved) throw new CitationError([{ kind: "unknown-excerpt", sourceId, excerptId }]);
      if (isStale(source, excerptId)) {
        throw new CitationError([{ kind: "stale-excerpt", sourceId, excerptId }]);
      }
      if (quote !== undefined && !comparable(resolved.text).includes(comparable(quote))) {
        throw new CitationError([{ kind: "quote-not-in-excerpt", sourceId, excerptId }]);
      }
      return resolved;
    },

    async resolveClaim(claimId) {
      const claim = await repositories.claims.get(claimId);
      if (!claim) throw new CitationError([{ kind: "unknown-claim", claimId }]);
      const { problems, excerpts } = await claimProblems(claim);
      if (problems.length > 0) throw new CitationError(problems);
      return { claim, excerpts };
    },

    async checkLesson(lesson) {
      const problems: CitationProblem[] = [];
      const stored = new Map(
        (await repositories.claims.getMany(lesson.claims.map((claim) => claim.claimId))).map(
          (claim) => [claim.claimId, claim],
        ),
      );
      for (const claim of lesson.claims) {
        const record = stored.get(claim.claimId);
        if (!record) {
          problems.push({ kind: "unknown-claim", claimId: claim.claimId });
          continue;
        }
        // A generator may copy a real id but change the words or sources; the store wins.
        if (canonicalJson(record) !== canonicalJson(claim)) {
          problems.push({ kind: "claim-mismatch", claimId: claim.claimId });
        }
        problems.push(...(await claimProblems(record)).problems);
      }
      return problems;
    },
  };
}
