import type { FreshnessStatus } from "@sbi/contracts";

export interface CitedSource {
  sourceId: string;
  freshness?: { status: FreshnessStatus; checkedAt: string };
}

/**
 * Outdated-source detection over the sources lessons cite: a source is outdated when its last
 * re-check found it changed, gone or with new rights, and unverified when it is overdue a check.
 */
export function outdatedSources(sources: CitedSource[], now: Date, maxAgeDays: number) {
  const due = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000;
  const outdated = sources.filter(
    (source) => source.freshness && source.freshness.status !== "current",
  );
  const unverified = sources.filter(
    (source) => !source.freshness || Date.parse(source.freshness.checkedAt) < due,
  );
  return {
    sources: sources.length,
    outdated: outdated.map((source) => source.sourceId),
    outdatedRate: sources.length === 0 ? 0 : outdated.length / sources.length,
    unverifiedRate: sources.length === 0 ? 0 : unverified.length / sources.length,
  };
}
