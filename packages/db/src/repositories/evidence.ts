import { Claim, EvidenceSource } from "@sbi/contracts";
import type { ClaimRepository, EvidenceSourceRepository } from "@sbi/evidence";
import { eq, inArray } from "drizzle-orm";
import type { Database } from "../client";
import { claims, evidenceSources } from "../schema";
import { parseDocuments } from "./document";

export function createEvidenceSourceRepository(db: Database): EvidenceSourceRepository {
  const select = () => db.select({ document: evidenceSources.document }).from(evidenceSources);

  return {
    async save(input) {
      const source = EvidenceSource.parse(input);
      const row = {
        sourceId: source.sourceId,
        rightsStatus: source.rightsStatus,
        lastCheckedAt: new Date(source.lastCheckedAt),
        document: source,
      };
      await db.insert(evidenceSources).values(row).onDuplicateKeyUpdate({ set: row });
    },
    async get(sourceId) {
      return parseDocuments(
        EvidenceSource,
        await select().where(eq(evidenceSources.sourceId, sourceId)),
      )[0];
    },
    async getMany(sourceIds) {
      if (sourceIds.length === 0) return [];
      return parseDocuments(
        EvidenceSource,
        await select().where(inArray(evidenceSources.sourceId, sourceIds)),
      );
    },
  };
}

export function createClaimRepository(db: Database): ClaimRepository {
  const select = () => db.select({ document: claims.document }).from(claims);

  return {
    async save(input) {
      const claim = Claim.parse(input);
      const row = { claimId: claim.claimId, status: claim.status, document: claim };
      await db.insert(claims).values(row).onDuplicateKeyUpdate({ set: row });
    },
    async get(claimId) {
      return parseDocuments(Claim, await select().where(eq(claims.claimId, claimId)))[0];
    },
    async getMany(claimIds) {
      if (claimIds.length === 0) return [];
      return parseDocuments(Claim, await select().where(inArray(claims.claimId, claimIds)));
    },
  };
}
