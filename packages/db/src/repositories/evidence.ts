import { createHash } from "node:crypto";
import { Claim, EvidenceSource } from "@sbi/contracts";
import {
  DuplicateSourceError,
  type ClaimRepository,
  type EvidenceSourceRepository,
  sourceLocatorKey,
  type SourceLocator,
} from "@sbi/evidence";
import { asc, desc, eq, inArray, lt } from "drizzle-orm";
import type { Database } from "../client";
import { claimDependencies, claims, claimSources, evidenceSources } from "../schema";
import { parseDocuments } from "./document";

// Drizzle wraps driver errors, so look for the MariaDB code on the error or its cause.
function isDuplicateLocator(error: unknown): boolean {
  for (let current = error; current instanceof Error; current = current.cause) {
    const { code, message } = current as Error & { code?: string };
    if (code === "ER_DUP_ENTRY" && message.includes("evidence_sources_locator")) return true;
  }
  return false;
}

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
      try {
        await db.transaction(async (tx) => {
          const [existing] = await tx
            .select({ sourceId: evidenceSources.sourceId })
            .from(evidenceSources)
            .where(eq(evidenceSources.sourceId, source.sourceId))
            .for("update");
          // No upsert: on a locator clash it would overwrite a different source's row.
          if (existing) {
            await tx
              .update(evidenceSources)
              .set(row)
              .where(eq(evidenceSources.sourceId, source.sourceId));
          } else {
            await tx.insert(evidenceSources).values(row);
          }
        });
      } catch (error) {
        if (isDuplicateLocator(error)) throw new DuplicateSourceError(sourceLocatorKey(source));
        throw error;
      }
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
    async listDueForCheck(checkedBefore, limit) {
      const rows = await select()
        .where(lt(evidenceSources.lastCheckedAt, checkedBefore))
        .orderBy(asc(evidenceSources.lastCheckedAt))
        .limit(limit);
      return parseDocuments(EvidenceSource, rows);
    },
  };
}

export function createClaimRepository(db: Database): ClaimRepository {
  const select = () => db.select({ document: claims.document }).from(claims);

  return {
    async save(input) {
      const claim = Claim.parse(input);
      const row = {
        claimId: claim.claimId,
        status: claim.status,
        judgeVersion: claim.verification?.judge ?? null,
        document: claim,
      };
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
    async findByJudge(judge) {
      return parseDocuments(Claim, await select().where(eq(claims.judgeVersion, judge)));
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
