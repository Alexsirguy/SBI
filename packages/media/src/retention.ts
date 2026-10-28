import { presignR2Url, type R2Credentials } from "./r2";

export type MediaObjectKind = "derivative" | "log" | "original";

export interface MediaObjectRecord {
  key: string;
  kind: MediaObjectKind;
  createdAt: Date;
  savedByUser: boolean;
}

export interface RetentionPolicy {
  originalTtlDays: number;
  derivativeTtlDays: number;
  logTtlDays: number;
}

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  derivativeTtlDays: 30,
  logTtlDays: 90,
  originalTtlDays: 7,
};

export interface MediaRegistry {
  listExpired(now: Date, policy: RetentionPolicy): Promise<MediaObjectRecord[]>;
  remove(keys: string[]): Promise<void>;
}

export interface ObjectStorage {
  remove(keys: string[]): Promise<void>;
}

export interface DeletionAuditEntry {
  key: string;
  kind: MediaObjectKind;
  deletedAt: Date;
  reason: string;
}

export interface DeletionAuditLog {
  record(entry: DeletionAuditEntry): Promise<void>;
}

export function ttlDaysFor(kind: MediaObjectKind, policy: RetentionPolicy): number {
  return kind === "original"
    ? policy.originalTtlDays
    : kind === "derivative"
      ? policy.derivativeTtlDays
      : policy.logTtlDays;
}

// Storage is deleted before the registry, so a failed pass retries instead of leaking.
export async function runDeletionPass(
  deps: { registry: MediaRegistry; storage: ObjectStorage; audit: DeletionAuditLog },
  now: Date,
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
): Promise<{ deleted: string[] }> {
  const expired = await deps.registry.listExpired(now, policy);
  const deleted: string[] = [];
  for (const record of expired) {
    await deps.storage.remove([record.key]);
    await deps.registry.remove([record.key]);
    await deps.audit.record({
      deletedAt: now,
      key: record.key,
      kind: record.kind,
      reason: `${record.kind} older than ${ttlDaysFor(record.kind, policy)} days`,
    });
    deleted.push(record.key);
  }
  return { deleted };
}

type FetchImpl = (url: string, init: { method: string }) => Promise<{ status: number }>;

// R2 speaks the S3 API, so single-object deletes reuse the presigning core.
export function createR2Storage(
  credentials: R2Credentials,
  fetchImpl: FetchImpl = fetch as FetchImpl,
): ObjectStorage {
  return {
    async remove(keys: string[]) {
      for (const key of keys) {
        const url = await presignR2Url(credentials, {
          expiresInSeconds: 60,
          key,
          method: "DELETE",
        });
        const response = await fetchImpl(url, { method: "DELETE" });
        if (response.status !== 200 && response.status !== 204 && response.status !== 404) {
          throw new Error(`Could not delete ${key}.`);
        }
      }
    },
  };
}
