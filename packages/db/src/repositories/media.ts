import { newId } from "@sbi/contracts";
import type {
  DeletionAuditLog,
  MediaObjectKind,
  MediaObjectRecord,
  MediaRegistry,
} from "@sbi/media";
import { and, asc, eq, gt, isNotNull, isNull, lt, lte, or, type SQL } from "drizzle-orm";
import type { Database } from "../client";
import { deletionAuditLog, mediaObjects } from "../schema";

const KINDS: MediaObjectKind[] = ["original", "derivative", "log"];

function toRecord(row: typeof mediaObjects.$inferSelect): MediaObjectRecord {
  const kind = row.kind as MediaObjectKind;
  if (!KINDS.includes(kind)) {
    throw new Error(`Unknown media kind: ${row.kind}.`);
  }
  return { createdAt: row.createdAt, expiresAt: row.expiresAt, key: row.objectKey, kind };
}

function affected(result: unknown): number {
  const [header] = result as [{ affectedRows?: number }];
  return header.affectedRows ?? 0;
}

// MariaDB counts changed rows, so an update that matches but changes nothing is re-checked.
async function matches(db: Database, key: string, condition: SQL | undefined): Promise<boolean> {
  const rows = await db
    .select({ key: mediaObjects.objectKey })
    .from(mediaObjects)
    .where(and(eq(mediaObjects.objectKey, key), condition));
  return rows.length === 1;
}

const expiredUnsaved = (now: Date) =>
  and(
    eq(mediaObjects.savedByUser, false),
    isNotNull(mediaObjects.expiresAt),
    lte(mediaObjects.expiresAt, now),
  );

export function createMediaRegistry(db: Database): MediaRegistry {
  return {
    async claimForDeletion(key, now) {
      const result = await db
        .update(mediaObjects)
        .set({ deletingAt: now })
        .where(
          and(
            eq(mediaObjects.objectKey, key),
            expiredUnsaved(now),
            isNull(mediaObjects.deletingAt),
          ),
        );
      return (
        affected(result) === 1 ||
        matches(db, key, and(expiredUnsaved(now), isNotNull(mediaObjects.deletingAt)))
      );
    },

    async expireSooner(key, expiresAt) {
      await db
        .update(mediaObjects)
        .set({ expiresAt })
        .where(
          and(
            eq(mediaObjects.objectKey, key),
            eq(mediaObjects.savedByUser, false),
            isNull(mediaObjects.deletingAt),
            or(isNull(mediaObjects.expiresAt), gt(mediaObjects.expiresAt, expiresAt)),
          ),
        );
    },

    async forget(key) {
      await db.delete(mediaObjects).where(eq(mediaObjects.objectKey, key));
    },

    // A claimed row is mid-deletion, so keeping it now would promise something already lost.
    async keep(key, consentVersion) {
      const result = await db
        .update(mediaObjects)
        .set({ consentVersion, expiresAt: null, savedByUser: true })
        .where(and(eq(mediaObjects.objectKey, key), isNull(mediaObjects.deletingAt)));
      return (
        affected(result) === 1 ||
        matches(db, key, and(isNull(mediaObjects.deletingAt), eq(mediaObjects.savedByUser, true)))
      );
    },

    async release(key, now) {
      const result = await db
        .update(mediaObjects)
        .set({ consentVersion: null, expiresAt: now, savedByUser: false })
        .where(eq(mediaObjects.objectKey, key));
      return affected(result) === 1 || matches(db, key, undefined);
    },

    async listExpired(now, limit) {
      const rows = await db
        .select()
        .from(mediaObjects)
        .where(expiredUnsaved(now))
        .orderBy(asc(mediaObjects.expiresAt))
        .limit(limit);
      return rows.map(toRecord);
    },

    async register(record) {
      await db.insert(mediaObjects).values({
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        kind: record.kind,
        objectKey: record.key,
      });
    },
  };
}

export function createDeletionAuditLog(db: Database): DeletionAuditLog {
  return {
    async purgeOlderThan(cutoff) {
      return affected(
        await db.delete(deletionAuditLog).where(lt(deletionAuditLog.deletedAt, cutoff)),
      );
    },
    async record(entry) {
      await db.insert(deletionAuditLog).values({
        auditId: newId(),
        deletedAt: entry.deletedAt,
        kind: entry.kind,
        objectKey: entry.key,
        reason: entry.reason,
      });
    },
  };
}
