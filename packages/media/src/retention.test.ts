import { describe, expect, it } from "vitest";
import {
  DEFAULT_RETENTION_POLICY,
  expiryFor,
  parseRetentionPolicy,
  recognisedExpiry,
  runDeletionPass,
  type DeletionAuditEntry,
  type MediaObjectRecord,
  type MediaRegistry,
} from "./retention";
import type { StoredObject } from "./storage";

const NOW = new Date("2026-10-28T12:00:00Z");
const HOUR = 3_600_000;

interface Row extends MediaObjectRecord {
  saved: boolean;
  claimed: boolean;
}

// Mirrors the SQL repository's contract; the MariaDB test in @sbi/db holds the real one to it.
function memoryRegistry(rows: Row[], hooks: { beforeClaim?: (key: string) => void } = {}) {
  const registry: MediaRegistry = {
    claimForDeletion: async (key, now) => {
      hooks.beforeClaim?.(key);
      const row = rows.find((candidate) => candidate.key === key);
      if (!row || row.saved || !row.expiresAt || row.expiresAt > now) {
        return false;
      }
      row.claimed = true;
      return true;
    },
    expireSooner: () => Promise.resolve(),
    forget: async (key) => {
      rows.splice(
        rows.findIndex((row) => row.key === key),
        1,
      );
    },
    keep: async (key) => {
      const row = rows.find((candidate) => candidate.key === key);
      if (!row || row.claimed) {
        return false;
      }
      row.saved = true;
      row.expiresAt = null;
      return true;
    },
    listExpired: async (now, limit) =>
      rows
        .filter((row) => !row.saved && row.expiresAt !== null && row.expiresAt <= now)
        .slice(0, limit),
    register: () => Promise.resolve(),
  };
  return registry;
}

function row(key: string, expiresAt: Date | null, overrides: Partial<Row> = {}): Row {
  return {
    claimed: false,
    createdAt: new Date(NOW.getTime() - 10 * 24 * HOUR),
    expiresAt,
    key,
    kind: "original",
    saved: false,
    ...overrides,
  };
}

function fakeStorage(objects: StoredObject[] = [], failOn?: string) {
  const removed: string[] = [];
  return {
    list: async (prefix: string) => objects.filter((object) => object.key.startsWith(prefix)),
    remove: async (keys: string[]) => {
      if (failOn && keys.includes(failOn)) {
        throw new Error("storage unavailable");
      }
      removed.push(...keys);
    },
    removed,
  };
}

function auditLog() {
  const entries: DeletionAuditEntry[] = [];
  let purgedBefore: Date | undefined;
  return {
    entries,
    purgeOlderThan: async (cutoff: Date) => {
      purgedBefore = cutoff;
      return 3;
    },
    purgedBefore: () => purgedBefore,
    record: async (entry: DeletionAuditEntry) => void entries.push(entry),
  };
}

describe("retention policy", () => {
  it("reads TTLs from env with privacy-first defaults", () => {
    expect(DEFAULT_RETENTION_POLICY).toEqual({
      auditTtlDays: 365,
      derivativeTtlDays: 30,
      logTtlDays: 90,
      originalTtlDays: 7,
      recognisedGraceHours: 1,
      stagingTtlHours: 24,
    });
    expect(
      parseRetentionPolicy({ MEDIA_TTL_DERIVATIVE_DAYS: "14", MEDIA_TTL_LOG_DAYS: "30" }),
    ).toMatchObject({ derivativeTtlDays: 14, logTtlDays: 30, originalTtlDays: 7 });
  });

  it("refuses to keep originals longer than the seven days the privacy notice promises", () => {
    expect(() => parseRetentionPolicy({ MEDIA_TTL_ORIGINAL_DAYS: "8" })).toThrow(
      "MEDIA_TTL_ORIGINAL_DAYS",
    );
  });

  it("dates expiry from creation per kind, and soon after recognition", () => {
    expect(expiryFor("derivative", NOW, DEFAULT_RETENTION_POLICY)).toEqual(
      new Date(NOW.getTime() + 30 * 24 * HOUR),
    );
    expect(recognisedExpiry(NOW, DEFAULT_RETENTION_POLICY)).toEqual(new Date(NOW.getTime() + HOUR));
  });
});

describe("runDeletionPass", () => {
  it("deletes expired objects, including one expiring exactly now, and audits each", async () => {
    const rows = [row("photos/a.jpg", NOW), row("photos/b.jpg", new Date(NOW.getTime() + 1))];
    const storage = fakeStorage();
    const audit = auditLog();
    const result = await runDeletionPass({ audit, registry: memoryRegistry(rows), storage }, NOW);

    expect(result.deleted).toEqual(["photos/a.jpg"]);
    expect(storage.removed).toEqual(["photos/a.jpg"]);
    expect(rows.map((candidate) => candidate.key)).toEqual(["photos/b.jpg"]);
    expect(audit.entries).toEqual([
      {
        deletedAt: NOW,
        key: "photos/a.jpg",
        kind: "original",
        reason: "original reached its retention limit",
      },
    ]);
  });

  it("never deletes a photo the learner kept while the pass was running", async () => {
    const rows = [row("photos/a.jpg", NOW)];
    const registry = memoryRegistry(rows, {
      beforeClaim: (key) => {
        void registry.keep(key);
      },
    });
    const storage = fakeStorage();
    const result = await runDeletionPass({ audit: auditLog(), registry, storage }, NOW);

    expect(result.deleted).toEqual([]);
    expect(storage.removed).toEqual([]);
    expect(rows[0]?.saved).toBe(true);
  });

  it("keeps the claim when storage fails so the next pass retries", async () => {
    const rows = [row("photos/a.jpg", NOW)];
    const registry = memoryRegistry(rows);
    await expect(
      runDeletionPass(
        { audit: auditLog(), registry, storage: fakeStorage([], "photos/a.jpg") },
        NOW,
      ),
    ).rejects.toThrow("storage unavailable");
    expect(rows[0]?.claimed).toBe(true);
    await expect(registry.keep("photos/a.jpg")).resolves.toBe(false);

    const retry = await runDeletionPass(
      { audit: auditLog(), registry, storage: fakeStorage() },
      NOW,
    );
    expect(retry.deleted).toEqual(["photos/a.jpg"]);
  });

  it("removes abandoned staging uploads and ages out the audit log", async () => {
    const storage = fakeStorage([
      { key: "staging/old.jpg", lastModified: new Date(NOW.getTime() - 25 * HOUR) },
      { key: "staging/new.jpg", lastModified: new Date(NOW.getTime() - HOUR) },
    ]);
    const audit = auditLog();
    const result = await runDeletionPass({ audit, registry: memoryRegistry([]), storage }, NOW);

    expect(result).toEqual({ auditPurged: 3, deleted: [], stagingDeleted: 1 });
    expect(storage.removed).toEqual(["staging/old.jpg"]);
    expect(audit.entries[0]).toMatchObject({ key: "staging/old.jpg", kind: "staging" });
    expect(audit.purgedBefore()).toEqual(new Date(NOW.getTime() - 365 * 24 * HOUR));
  });

  it("works through a bounded batch per pass", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => row(`photos/${i}.jpg`, NOW));
    const result = await runDeletionPass(
      { audit: auditLog(), registry: memoryRegistry(rows), storage: fakeStorage() },
      NOW,
      DEFAULT_RETENTION_POLICY,
      2,
    );
    expect(result.deleted).toHaveLength(2);
    expect(rows).toHaveLength(3);
  });
});
