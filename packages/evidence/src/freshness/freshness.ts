import {
  EvidenceInvalidated,
  EvidenceSource,
  type FreshnessStatus,
  type RightsStatus,
} from "@sbi/contracts";
import { collectDependents } from "../claims/graph";
import type { EvidenceRepositories } from "../claims/persist";
import { SourceFetchError } from "../retrieval/http";
import { type Retriever, UntrustedSourceError } from "../retrieval/retriever";
import { comparableText } from "../retrieval/text";

export interface InvalidationSink {
  publish(event: EvidenceInvalidated): Promise<void>;
}

export type CheckOutcome =
  { status: FreshnessStatus; source: EvidenceSource } | { status: "error"; reason: string };

const DAY_MS = 86_400_000;

// Higher means fewer permissions; only a move up should pull lessons.
const RESTRICTIVENESS: Record<RightsStatus, number> = {
  reusable: 0,
  "quote-only": 1,
  "link-only": 2,
  restricted: 3,
  unknown: 4,
};

/** Re-fetches one source and reports whether the excerpts its claims cite still hold. */
export async function checkSource(
  source: EvidenceSource,
  retriever: Retriever,
  { now, signal }: { now: Date; signal?: AbortSignal },
): Promise<CheckOutcome> {
  const checkedAt = now.toISOString();
  const recheck = (
    status: FreshnessStatus,
    changes: Partial<EvidenceSource> = {},
    missing: string[] = [],
  ) => ({
    status,
    source: EvidenceSource.parse({
      ...source,
      ...changes,
      lastCheckedAt: checkedAt,
      freshness: { status, checkedAt, missingExcerptIds: missing },
    }),
  });

  let fetched;
  try {
    fetched = await retriever.retrieve(
      { doi: source.doi, url: source.doi ? undefined : source.url },
      { signal, prefer: source.retrieval?.connector },
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    const gone =
      error instanceof UntrustedSourceError ||
      (error instanceof SourceFetchError && (error.status === 404 || error.status === 410));
    if (gone) return recheck("gone");
    return { status: "error", reason: error instanceof Error ? error.message : String(error) };
  }

  const changes = { retrieval: fetched.retrieval, rightsStatus: fetched.rightsStatus };
  const unchanged = fetched.retrieval.contentSha256 === source.retrieval?.contentSha256;
  const text = comparableText(fetched.passages.map((passage) => passage.text).join("\n"));
  const missing = unchanged
    ? []
    : source.excerpts
        .filter((excerpt) => !text.includes(comparableText(excerpt.text)))
        .map((excerpt) => excerpt.excerptId);
  if (missing.length > 0) return recheck("changed", changes, missing);
  if (RESTRICTIVENESS[fetched.rightsStatus] > RESTRICTIVENESS[source.rightsStatus]) {
    return recheck("rights-changed", changes);
  }
  return recheck("current", changes);
}

export interface FreshnessPassOptions {
  repositories: EvidenceRepositories;
  retriever: Retriever;
  sink: InvalidationSink;
  now: Date;
  maxAgeDays: number;
  limit: number;
  signal?: AbortSignal;
}

export interface FreshnessPassResult {
  checked: number;
  current: number;
  errors: number;
  invalidated: { sourceId: string; reason: FreshnessStatus; claims: number }[];
}

/** One scheduled pass: re-checks the stalest sources and invalidates claims on the ones that moved. */
export async function runFreshnessPass(
  options: FreshnessPassOptions,
): Promise<FreshnessPassResult> {
  const { repositories, now } = options;
  const due = await repositories.sources.listDueForCheck(
    new Date(now.getTime() - options.maxAgeDays * DAY_MS),
    options.limit,
  );
  const result: FreshnessPassResult = { checked: 0, current: 0, errors: 0, invalidated: [] };

  for (const source of due) {
    const outcome = await checkSource(source, options.retriever, { now, signal: options.signal });
    result.checked += 1;
    if (outcome.status === "error") {
      result.errors += 1;
      // Retry in a day rather than every pass, so one failing host cannot fill each batch.
      const retryAt = new Date(now.getTime() - (options.maxAgeDays - 1) * DAY_MS);
      await repositories.sources.save({ ...source, lastCheckedAt: retryAt.toISOString() });
      continue;
    }
    await repositories.sources.save(outcome.source);
    if (outcome.status === "current") {
      result.current += 1;
      continue;
    }
    // Already reported for the same reason on an earlier pass.
    if (source.freshness?.status === outcome.status) continue;

    const direct = (await repositories.claims.findBySource(source.sourceId)).map(
      (claim) => claim.claimId,
    );
    const claimIds = [...direct, ...(await collectDependents(repositories.claims, direct))];
    await options.sink.publish(
      EvidenceInvalidated.parse({
        type: "evidence.invalidated",
        sourceId: source.sourceId,
        reason: outcome.status,
        claimIds,
        detectedAt: now.toISOString(),
      }),
    );
    result.invalidated.push({
      sourceId: source.sourceId,
      reason: outcome.status,
      claims: claimIds.length,
    });
  }
  return result;
}
