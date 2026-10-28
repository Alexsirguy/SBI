import {
  DEFAULT_RETENTION_POLICY,
  runDeletionPass,
  type DeletionAuditLog,
  type MediaRegistry,
  type ObjectStorage,
  type RetentionPolicy,
} from "@sbi/media";

export interface PurgeDeps {
  registry: MediaRegistry;
  storage: ObjectStorage;
  audit: DeletionAuditLog;
}

// The scheduler calls with a shared secret; nothing else may trigger deletion.
export function isAuthorized(header: string | null, token: string | undefined): boolean {
  return !!token && header === `Bearer ${token}`;
}

export function runPurge(
  deps: PurgeDeps,
  now: Date,
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
): Promise<{ deleted: string[] }> {
  return runDeletionPass(deps, now, policy);
}
