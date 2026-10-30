import { type Claim, type EvidenceSource, EvidenceSource as SourceSchema } from "@sbi/contracts";
import {
  type ClaimRepository,
  DuplicateSourceError,
  type EvidenceSourceRepository,
} from "../repositories";
import type { BuiltClaims } from "./builder";

export interface EvidenceRepositories {
  sources: EvidenceSourceRepository;
  claims: ClaimRepository;
}

/** Saves a build, merging sources into stored ones with the same DOI or URL and remapping citations. */
export async function saveClaimGraph(
  repositories: EvidenceRepositories,
  built: BuiltClaims,
): Promise<{ claims: Claim[]; sources: EvidenceSource[] }> {
  const remap = new Map<string, { sourceId: string; excerpts: Map<string, string> }>();
  const sources: EvidenceSource[] = [];

  for (const source of built.sources) {
    let stored = await repositories.sources.findByLocator(source);
    if (!stored) {
      try {
        await repositories.sources.save(source);
        sources.push(source);
        continue;
      } catch (error) {
        // Another build stored this source between our lookup and insert; merge into theirs.
        if (!(error instanceof DuplicateSourceError)) throw error;
        stored = await repositories.sources.findByLocator(source);
        if (!stored) throw error;
      }
    }
    const excerpts = [...stored.excerpts];
    const excerptIds = new Map<string, string>();
    for (const excerpt of source.excerpts) {
      const same = excerpts.find((existing) => existing.text === excerpt.text);
      if (same) {
        excerptIds.set(excerpt.excerptId, same.excerptId);
        continue;
      }
      const excerptId = `x${excerpts.length + 1}`;
      excerpts.push({ ...excerpt, excerptId });
      excerptIds.set(excerpt.excerptId, excerptId);
    }
    remap.set(source.sourceId, { sourceId: stored.sourceId, excerpts: excerptIds });
    sources.push(
      SourceSchema.parse({
        ...source,
        sourceId: stored.sourceId,
        excerpts,
        claimIds: [...new Set([...stored.claimIds, ...source.claimIds])],
      }),
    );
  }

  // Merging can map two built sources onto one stored source; each link is kept once.
  const claims = built.claims.map((claim) => {
    const citations = claim.citations?.map((citation) => {
      const moved = remap.get(citation.sourceId);
      return moved
        ? {
            sourceId: moved.sourceId,
            excerptId: moved.excerpts.get(citation.excerptId) ?? citation.excerptId,
          }
        : citation;
    });
    return {
      ...claim,
      sourceIds: [...new Set(claim.sourceIds.map((id) => remap.get(id)?.sourceId ?? id))],
      citations: citations?.filter(
        (citation, index) =>
          citations.findIndex(
            (other) =>
              other.sourceId === citation.sourceId && other.excerptId === citation.excerptId,
          ) === index,
      ),
    };
  });

  for (const source of sources) await repositories.sources.save(source);
  for (const claim of claims) await repositories.claims.save(claim);
  return { claims, sources };
}
