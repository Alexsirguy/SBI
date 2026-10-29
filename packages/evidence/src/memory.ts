import { Claim, EvidenceSource } from "@sbi/contracts";
import {
  DuplicateSourceError,
  type ClaimRepository,
  type EvidenceSourceRepository,
  sourceLocatorKey,
} from "./repositories";

export interface MemoryEvidenceRepositories {
  sources: EvidenceSourceRepository;
  claims: ClaimRepository;
}

/** In-process store for tests and local tools; validates like the SQL store does. */
export function createMemoryEvidenceRepositories(): MemoryEvidenceRepositories {
  const sources = new Map<string, EvidenceSource>();
  const claims = new Map<string, Claim>();
  const pick = <T>(store: Map<string, T>, ids: string[]) =>
    ids.flatMap((id) => (store.has(id) ? [structuredClone(store.get(id) as T)] : []));

  return {
    sources: {
      async save(input) {
        const source = EvidenceSource.parse(input);
        const key = sourceLocatorKey(source);
        const holder = [...sources.values()].find((item) => sourceLocatorKey(item) === key);
        if (holder && holder.sourceId !== source.sourceId) throw new DuplicateSourceError(key);
        sources.set(source.sourceId, structuredClone(source));
      },
      async get(sourceId) {
        return pick(sources, [sourceId])[0];
      },
      async getMany(sourceIds) {
        return pick(sources, sourceIds);
      },
      async findByLocator(locator) {
        const key = sourceLocatorKey(locator);
        const found = [...sources.values()].find((source) => sourceLocatorKey(source) === key);
        return found && structuredClone(found);
      },
      async delete(sourceId) {
        return sources.delete(sourceId);
      },
      async listDueForCheck(checkedBefore, limit) {
        return [...sources.values()]
          .filter((source) => Date.parse(source.lastCheckedAt) < checkedBefore.getTime())
          .sort((a, b) => Date.parse(a.lastCheckedAt) - Date.parse(b.lastCheckedAt))
          .slice(0, limit)
          .map((source) => structuredClone(source));
      },
    },
    claims: {
      async save(input) {
        const claim = Claim.parse(input);
        claims.set(claim.claimId, structuredClone(claim));
      },
      async get(claimId) {
        return pick(claims, [claimId])[0];
      },
      async getMany(claimIds) {
        return pick(claims, claimIds);
      },
      async delete(claimId) {
        return claims.delete(claimId);
      },
      async findDependents(claimId) {
        return [...claims.values()]
          .filter((claim) => claim.dependsOn.includes(claimId))
          .map((claim) => structuredClone(claim));
      },
      async findByJudge(judge) {
        return [...claims.values()]
          .filter((claim) => claim.verification?.judge === judge)
          .map((claim) => structuredClone(claim));
      },
      async findBySource(sourceId) {
        return [...claims.values()]
          .filter((claim) => claim.sourceIds.includes(sourceId))
          .map((claim) => structuredClone(claim));
      },
    },
  };
}
