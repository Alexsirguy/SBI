import { createHash } from "node:crypto";
import { Claim, EvidenceSource } from "@sbi/contracts";
import {
  type ClaimRepository,
  type EvidenceSourceRepository,
  sourceLocatorKey,
  type SourceLocator,
} from "@sbi/evidence";
import { desc, eq, inArray } from "drizzle-orm";
import type { Database } from "../client";
import { claimDependencies, claims, claimSources, evidenceSources } from "../schema";
import { parseDocuments } from "./document";

const locatorHash = (locator: SourceLocator) =>
  createHash("sha256").update(sourceLocatorKey(locator)).digest("hex");

export function createEvidenceSourceRepository(db: Database): EvidenceSourceRepository {
  const select = () => db.select({ document: evidenceSources.document }).from(evidenceSources);

  return {
    async save(input) {
      const source = EvidenceSource.parse(input);
      const row = {
        sourceId: source.sourceId,
        locatorSha256: locatorHash(source),
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
    async findByLocator(locator) {
      const rows = await select()
        .where(eq(evidenceSources.locatorSha256, locatorHash(locator)))
        .orderBy(desc(evidenceSources.lastCheckedAt))
        .limit(1);
      return parseDocuments(EvidenceSource, rows)[0];
    },
    async delete(sourceId) {
      const [result] = await db
        .delete(evidenceSources)
        .where(eq(evidenceSources.sourceId, sourceId));
      return result.affectedRows > 0;
    },
  };
}

export function createClaimRepository(db: Database): ClaimRepository {
  const select = () => db.select({ document: claims.document }).from(claims);

  return {
    async save(input) {
      const claim = Claim.parse(input);
      const row = { claimId: claim.claimId, status: claim.status, document: claim };
      await db.transaction(async (tx) => {
        await tx.insert(claims).values(row).onDuplicateKeyUpdate({ set: row });
        await tx.delete(claimDependencies).where(eq(claimDependencies.claimId, claim.claimId));
        await tx.delete(claimSources).where(eq(claimSources.claimId, claim.claimId));
        if (claim.dependsOn.length > 0) {
          await tx
            .insert(claimDependencies)
            .values(claim.dependsOn.map((dependsOn) => ({ claimId: claim.claimId, dependsOn })));
        }
        if (claim.sourceIds.length > 0) {
          await tx
            .insert(claimSources)
            .values(claim.sourceIds.map((sourceId) => ({ claimId: claim.claimId, sourceId })));
        }
      });
    },
    async get(claimId) {
      return parseDocuments(Claim, await select().where(eq(claims.claimId, claimId)))[0];
    },
    async getMany(claimIds) {
      if (claimIds.length === 0) return [];
      return parseDocuments(Claim, await select().where(inArray(claims.claimId, claimIds)));
    },
    async delete(claimId) {
      const [result] = await db.delete(claims).where(eq(claims.claimId, claimId));
      return result.affectedRows > 0;
    },
    async findDependents(claimId) {
      const rows = await db
        .select({ document: claims.document })
        .from(claims)
        .innerJoin(claimDependencies, eq(claimDependencies.claimId, claims.claimId))
        .where(eq(claimDependencies.dependsOn, claimId));
      return parseDocuments(Claim, rows);
    },
    async findBySource(sourceId) {
      const rows = await db
        .select({ document: claims.document })
        .from(claims)
        .innerJoin(claimSources, eq(claimSources.claimId, claims.claimId))
        .where(eq(claimSources.sourceId, sourceId));
      return parseDocuments(Claim, rows);
    },
  };
}
