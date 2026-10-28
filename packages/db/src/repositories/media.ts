import { newId } from "@sbi/contracts";
import type {
  DeletionAuditEntry,
  DeletionAuditLog,
  MediaObjectKind,
  MediaObjectRecord,
  MediaRegistry,
  RetentionPolicy,
} from "@sbi/media";
import { and, eq, inArray, lte, or } from "drizzle-orm";
import type { Database } from "../client";
import { deletionAuditLog, mediaObjects } from "../schema";

const KINDS: MediaObjectKind[] = ["original", "derivative", "log"];

function toRecord(row: typeof mediaObjects.$inferSelect): MediaObjectRecord {
  const kind = row.kind as MediaObjectKind;
  if (!KINDS.includes(kind)) {
    throw new Error(`Unknown media kind: ${row.kind}.`);
  }
  return {
    createdAt: row.createdAt,
    key: row.objectKey,
    kind,
    savedByUser: row.savedByUser,
  };
}

function expired(kind: MediaObjectKind, now: Date, policy: RetentionPolicy) {
  const days =
    kind === "original"
      ? policy.originalTtlDays
      : kind === "derivative"
        ? policy.derivativeTtlDays
        : policy.logTtlDays;
  const clauses = [
    eq(mediaObjects.kind, kind),
    lte(mediaObjects.createdAt, new Date(now.getTime() - days * 86_400_000)),
  ];
  // Saved originals survive until the learner deletes them.
  return kind === "original"
    ? and(...clauses, eq(mediaObjects.savedByUser, false))
    : and(...clauses);
}

export interface MediaStores {
  registry: MediaRegistry & { save(record: MediaObjectRecord): Promise<void> };
  audit: DeletionAuditLog;
}

export function createMediaStores(db: Database): MediaStores {
  return {
    audit: {
      async record(entry: DeletionAuditEntry) {
        await db.insert(deletionAuditLog).values({
          auditId: newId(),
          deletedAt: entry.deletedAt,
          kind: entry.kind,
          objectKey: entry.key,
          reason: entry.reason,
        });
      },
    },
    registry: {
      async listExpired(now, policy) {
        const rows = await db
          .select()
          .from(mediaObjects)
          .where(
            or(
              expired("original", now, policy),
              expired("derivative", now, policy),
              expired("log", now, policy),
            ),
          );
        return rows.map(toRecord);
      },
      async remove(keys) {
        if (keys.length > 0) {
          await db.delete(mediaObjects).where(inArray(mediaObjects.objectKey, keys));
        }
      },
      async save(record) {
        const row = {
          createdAt: record.createdAt,
          kind: record.kind,
          objectKey: record.key,
          savedByUser: record.savedByUser,
        };
        await db.insert(mediaObjects).values(row).onDuplicateKeyUpdate({ set: row });
      },
    },
  };
}
