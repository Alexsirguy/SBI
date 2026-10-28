import { createEnv, type EnvSource } from "@sbi/env";
import { z } from "zod";
import type { ObjectStorage } from "./storage";
import { STAGING_PREFIX } from "./uploads";

export type MediaObjectKind = "original" | "derivative" | "log";

export interface MediaObjectRecord {
  key: string;
  kind: MediaObjectKind;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface RetentionPolicy {
  originalTtlDays: number;
  derivativeTtlDays: number;
  logTtlDays: number;
  auditTtlDays: number;
  recognisedGraceHours: number;
  stagingTtlHours: number;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const schema = z.object({
  MEDIA_TTL_AUDIT_DAYS: z.coerce.number().int().positive().default(365),
  MEDIA_TTL_DERIVATIVE_DAYS: z.coerce.number().int().positive().default(30),
  MEDIA_TTL_LOG_DAYS: z.coerce.number().int().positive().default(90),
  MEDIA_TTL_ORIGINAL_DAYS: z.coerce.number().int().positive().max(30).default(7),
  MEDIA_TTL_RECOGNISED_GRACE_HOURS: z.coerce.number().int().nonnegative().default(1),
  MEDIA_TTL_STAGING_HOURS: z.coerce.number().int().positive().default(24),
});

export function parseRetentionPolicy(source: EnvSource): RetentionPolicy {
  const env = createEnv(schema, source);
  return {
    auditTtlDays: env.MEDIA_TTL_AUDIT_DAYS,
    derivativeTtlDays: env.MEDIA_TTL_DERIVATIVE_DAYS,
    logTtlDays: env.MEDIA_TTL_LOG_DAYS,
    originalTtlDays: env.MEDIA_TTL_ORIGINAL_DAYS,
    recognisedGraceHours: env.MEDIA_TTL_RECOGNISED_GRACE_HOURS,
    stagingTtlHours: env.MEDIA_TTL_STAGING_HOURS,
  };
}

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = parseRetentionPolicy({});

export function ttlDaysFor(kind: MediaObjectKind, policy: RetentionPolicy): number {
  return kind === "original"
    ? policy.originalTtlDays
    : kind === "derivative"
      ? policy.derivativeTtlDays
      : policy.logTtlDays;
}

export function expiryFor(kind: MediaObjectKind, createdAt: Date, policy: RetentionPolicy): Date {
  return new Date(createdAt.getTime() + ttlDaysFor(kind, policy) * DAY_MS);
}

// Recognition is the photo's only purpose, so once it is done the original goes soon after.
export function recognisedExpiry(now: Date, policy: RetentionPolicy): Date {
  return new Date(now.getTime() + policy.recognisedGraceHours * HOUR_MS);
}

export interface MediaRegistry {
  register(record: MediaObjectRecord): Promise<void>;
  /** Brings expiry forward for an unsaved object; never extends it. */
  expireSooner(key: string, expiresAt: Date): Promise<void>;
  /** Returns false when the object is gone or already being deleted. */
  keep(key: string): Promise<boolean>;
  listExpired(now: Date, limit: number): Promise<MediaObjectRecord[]>;
  /** Atomically marks an expired, unsaved object for deletion so a late keep cannot race it. */
  claimForDeletion(key: string, now: Date): Promise<boolean>;
  forget(key: string): Promise<void>;
}

export interface DeletionAuditEntry {
  key: string;
  kind: MediaObjectKind | "staging";
  deletedAt: Date;
  reason: string;
}

export interface DeletionAuditLog {
  record(entry: DeletionAuditEntry): Promise<void>;
  purgeOlderThan(cutoff: Date): Promise<number>;
}

export interface DeletionPassResult {
  deleted: string[];
  stagingDeleted: number;
  auditPurged: number;
}

export interface DeletionPassDeps {
  registry: MediaRegistry;
  storage: Pick<ObjectStorage, "list" | "remove">;
  audit: DeletionAuditLog;
}

// Rows are claimed before storage is touched and forgotten after, so failures retry, never leak.
export async function runDeletionPass(
  deps: DeletionPassDeps,
  now: Date,
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
  batchSize = 500,
): Promise<DeletionPassResult> {
  const deleted: string[] = [];
  for (const record of await deps.registry.listExpired(now, batchSize)) {
    if (!(await deps.registry.claimForDeletion(record.key, now))) {
      continue;
    }
    await deps.storage.remove([record.key]);
    await deps.registry.forget(record.key);
    await deps.audit.record({
      deletedAt: now,
      key: record.key,
      kind: record.kind,
      reason: `${record.kind} reached its retention limit`,
    });
    deleted.push(record.key);
  }

  const stagingCutoff = now.getTime() - policy.stagingTtlHours * HOUR_MS;
  const abandoned = (await deps.storage.list(STAGING_PREFIX))
    .filter((object) => object.lastModified.getTime() <= stagingCutoff)
    .map((object) => object.key);
  await deps.storage.remove(abandoned);
  for (const key of abandoned) {
    await deps.audit.record({
      deletedAt: now,
      key,
      kind: "staging",
      reason: "upload never confirmed",
    });
  }

  const auditPurged = await deps.audit.purgeOlderThan(
    new Date(now.getTime() - policy.auditTtlDays * DAY_MS),
  );
  return { auditPurged, deleted, stagingDeleted: abandoned.length };
}
