import { Claim, type ClaimStatus, type EvidenceSource, newId } from "@sbi/contracts";
import { toEvidenceSource } from "../retrieval/retriever";
import type { FetchedSource, Passage } from "../retrieval/types";
import { QUOTE_LIMIT_CHARS } from "../citations/display";
import { applySourcePolicy, independentSourceCount } from "../policy/two-source";
import { orderByDependencies } from "./graph";
import type { SupportJudge, SupportVerdict } from "./judge";
import { claimTerms, matchTerms } from "./terms";

export interface ClaimDraft {
  /** Local to one build; the builder assigns real claim ids. */
  key: string;
  text: string;
  scope: string;
  dependsOn?: string[];
  /** How to word the claim when no source backs it; without one, it is removed. */
  openQuestion?: string;
  /** Textbook basics may rest on one source; everything else needs two (§7). */
  basic?: boolean;
}

export interface RemovedClaim {
  key: string;
  text: string;
  reason: string;
}

export interface BuiltClaims {
  claims: Claim[];
  sources: EvidenceSource[];
  /** Draft key to claim id, for drafts that survived. */
  ids: Record<string, string>;
  removed: RemovedClaim[];
  judgeVersion: string;
}

export interface BuildOptions {
  judge: SupportJudge;
  /** Judge calls in flight at once; the provider's rate limit is the real ceiling. */
  concurrency?: number;
  now?: () => Date;
  maxPassagesPerClaim?: number;
  signal?: AbortSignal;
}

type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

function limiter(size: number): Limiter {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async (task) => {
    if (active >= size) await new Promise<void>((resolve) => waiting.push(resolve));
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}

interface Judged {
  sourceIndex: number;
  passage: Passage;
  verdict: SupportVerdict["verdict"];
}

/** For quote-only sources, only the judge's short quote may be stored, never the paragraph. */
function storable(source: FetchedSource, passage: Passage, quote: string | undefined) {
  if (source.rightsStatus !== "quote-only") return passage;
  return quote && quote.length <= QUOTE_LIMIT_CHARS
    ? { location: passage.location, text: quote }
    : undefined;
}

class SourceSlots {
  private readonly slots = new Map<
    number,
    { sourceId: string; passages: Passage[]; claimIds: Set<string> }
  >();

  constructor(private readonly fetched: FetchedSource[]) {}

  cite(sourceIndex: number, passage: Passage, claimId: string) {
    let slot = this.slots.get(sourceIndex);
    if (!slot) {
      slot = { sourceId: newId(), passages: [], claimIds: new Set() };
      this.slots.set(sourceIndex, slot);
    }
    let position = slot.passages.findIndex(
      (stored) => stored.location === passage.location && stored.text === passage.text,
    );
    if (position === -1) position = slot.passages.push(passage) - 1;
    slot.claimIds.add(claimId);
    return { sourceId: slot.sourceId, excerptId: `x${position + 1}` };
  }

  build(): EvidenceSource[] {
    return [...this.slots.entries()].map(([index, slot]) =>
      toEvidenceSource(this.fetched[index] as FetchedSource, {
        sourceId: slot.sourceId,
        passages: slot.passages,
        claimIds: [...slot.claimIds],
      }),
    );
  }
}

async function judgeDraft(
  draft: ClaimDraft,
  fetched: FetchedSource[],
  options: BuildOptions,
  limit: Limiter,
): Promise<Judged[]> {
  const profile = claimTerms(draft.text);
  const ranked = fetched
    .flatMap((source, sourceIndex) =>
      source.passages.map((passage) => ({
        sourceIndex,
        passage,
        match: matchTerms(profile, passage.text),
      })),
    )
    .filter((candidate) => candidate.match.passes)
    .sort((a, b) => b.match.score - a.match.score);
  // The page a claim came from always matches best; each source's best passage goes first so a
  // second source is actually judged.
  const firsts = ranked.filter(
    (item, index) => ranked.findIndex((other) => other.sourceIndex === item.sourceIndex) === index,
  );
  const candidates = [...firsts, ...ranked.filter((item) => !firsts.includes(item))].slice(
    0,
    options.maxPassagesPerClaim ?? 2,
  );
  const judged: Judged[] = [];
  const verdicts = await Promise.all(
    candidates.map((candidate) =>
      limit(() =>
        options.judge.judge(
          {
            claim: draft.text,
            scope: draft.scope,
            excerpt: candidate.passage.text,
            location: candidate.passage.location,
            sourceTitle: (fetched[candidate.sourceIndex] as FetchedSource).title,
          },
          { signal: options.signal },
        ),
      ),
    ),
  );
  candidates.forEach((candidate, index) => {
    const { verdict, quote } = verdicts[index] as SupportVerdict;
    const source = fetched[candidate.sourceIndex] as FetchedSource;
    const passage = storable(source, candidate.passage, quote);
    if (passage) judged.push({ sourceIndex: candidate.sourceIndex, passage, verdict });
  });
  return judged;
}

/** Turns drafted claims into stored-evidence claims; nothing is "supported" without an excerpt. */
export async function buildClaims(
  drafts: ClaimDraft[],
  fetched: FetchedSource[],
  options: BuildOptions,
): Promise<BuiltClaims> {
  const ordered = orderByDependencies(
    drafts,
    (draft) => draft.key,
    (draft) => draft.dependsOn ?? [],
  );
  const slots = new SourceSlots(fetched);
  const ids: Record<string, string> = {};
  const statuses = new Map<string, ClaimStatus>();
  const claims: Claim[] = [];
  const removed: RemovedClaim[] = [];

  const verifiedAt = (options.now?.() ?? new Date()).toISOString();

  // Judging one draft never depends on another, so all run up front under one concurrency limit.
  const limit = limiter(options.concurrency ?? 6);
  const allJudged = await Promise.all(
    ordered.map((draft) => judgeDraft(draft, fetched, options, limit)),
  );

  for (const [index, draft] of ordered.entries()) {
    const judged = allJudged[index] as Judged[];
    const supporting = judged.filter((item) => item.verdict === "supports");
    const contradicting = judged.filter((item) => item.verdict === "contradicts");
    const backed = supporting.length > 0;

    if (!backed && !draft.openQuestion) {
      removed.push({
        key: draft.key,
        text: draft.text,
        reason: contradicting.length > 0 ? "contradicted" : "no-support",
      });
      continue;
    }

    const claimId = newId();
    ids[draft.key] = claimId;
    const dependencyKeys = draft.dependsOn ?? [];
    const lostDependency = dependencyKeys.some((key) => !ids[key]);
    const weakDependency = dependencyKeys.some((key) => statuses.get(key) === "unsupported");
    const cited = backed ? [...supporting, ...contradicting] : contradicting;
    const citations = cited.map((item) => slots.cite(item.sourceIndex, item.passage, claimId));
    const sourceIds = [...new Set(citations.map((citation) => citation.sourceId))];

    let status: ClaimStatus;
    let uncertainty: string | undefined;
    if (!backed) {
      status = "unsupported";
      uncertainty =
        contradicting.length > 0
          ? "A trusted source contradicts this, so it stays an open question."
          : "We have not found a trusted source for this yet.";
    } else if (contradicting.length > 0) {
      status = "disputed";
      uncertainty = "Trusted sources disagree on this.";
    } else if (lostDependency || weakDependency) {
      status = "qualified";
      uncertainty = "It builds on a step we could not verify.";
    } else {
      status = "supported";
    }
    statuses.set(draft.key, status);

    claims.push(
      Claim.parse({
        claimId,
        text: backed ? draft.text : draft.openQuestion,
        status,
        sourceIds,
        scope: draft.scope,
        confidence: status === "unsupported" ? "low" : "medium",
        uncertainty,
        dependsOn: dependencyKeys.flatMap((key) => (ids[key] ? [ids[key]] : [])),
        citations,
        significance: draft.basic ? "basic" : undefined,
        verification: { judge: options.judge.version, verifiedAt },
      }),
    );
  }

  const sources = slots.build();
  const checked = claims.map((claim) => {
    const supporting = sources.filter((source) =>
      claim.citations?.some((citation) => citation.sourceId === source.sourceId),
    );
    const confident = claim.status === "supported" && independentSourceCount(supporting) >= 2;
    return applySourcePolicy(confident ? { ...claim, confidence: "high" } : claim, sources);
  });
  return { claims: checked, sources, ids, removed, judgeVersion: options.judge.version };
}
