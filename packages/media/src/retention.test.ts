import { describe, expect, it } from "vitest";
import {
  DEFAULT_RETENTION_POLICY,
  runDeletionPass,
  type DeletionAuditEntry,
  type MediaObjectRecord,
  type MediaRegistry,
} from "./retention";

const NOW = new Date("2026-02-01T00:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

function record(overrides: Partial<MediaObjectRecord> & { key: string }): MediaObjectRecord {
  return {
    createdAt: daysAgo(30),
    kind: "original",
    savedByUser: false,
    ...overrides,
  };
}

function harness(objects: MediaObjectRecord[]) {
  const removed: string[] = [];
  const stored: string[] = [];
  const audited: DeletionAuditEntry[] = [];
  const registry: MediaRegistry = {
    listExpired(now, policy) {
      return Promise.resolve(
        objects.filter((item) => {
          const ttl =
            item.kind === "original"
              ? policy.originalTtlDays
              : item.kind === "derivative"
                ? policy.derivativeTtlDays
                : policy.logTtlDays;
          return !item.savedByUser && now.getTime() - item.createdAt.getTime() > ttl * 86_400_000;
        }),
      );
    },
    remove(keys) {
      removed.push(...keys);
      return Promise.resolve();
    },
  };
  return {
    audited,
    deps: {
      audit: {
        record(entry: DeletionAuditEntry) {
          audited.push(entry);
          return Promise.resolve();
        },
      },
      registry,
      storage: {
        remove(keys: string[]) {
          stored.push(...keys);
          return Promise.resolve();
        },
      },
    },
    removed,
    stored,
  };
}

describe("runDeletionPass", () => {
  it("deletes expired originals and audits each deletion", async () => {
    const expired = record({ createdAt: daysAgo(8), key: "uploads/old.jpg" });
    const fresh = record({ createdAt: daysAgo(2), key: "uploads/new.jpg" });
    const saved = record({ createdAt: daysAgo(60), key: "uploads/kept.jpg", savedByUser: true });
    const { audited, deps, removed, stored } = harness([expired, fresh, saved]);

    const result = await runDeletionPass(deps, NOW, DEFAULT_RETENTION_POLICY);

    expect(result).toEqual({ deleted: ["uploads/old.jpg"] });
    expect(stored).toEqual(["uploads/old.jpg"]);
    expect(removed).toEqual(["uploads/old.jpg"]);
    expect(audited).toEqual([
      {
        deletedAt: NOW,
        key: "uploads/old.jpg",
        kind: "original",
        reason: "original older than 7 days",
      },
    ]);
  });

  it("applies each kind's own TTL", async () => {
    const youngDerivative = record({
      createdAt: daysAgo(10),
      key: "d.jpg",
      kind: "derivative",
    });
    const oldLog = record({ createdAt: daysAgo(100), key: "l", kind: "log" });
    const { deps } = harness([youngDerivative, oldLog]);

    const result = await runDeletionPass(deps, NOW, DEFAULT_RETENTION_POLICY);

    expect(result).toEqual({ deleted: ["l"] });
  });

  it("keeps the registry record when storage deletion fails", async () => {
    const expired = record({ createdAt: daysAgo(8), key: "uploads/old.jpg" });
    const { audited, deps, removed } = harness([expired]);
    deps.storage.remove = () => Promise.reject(new Error("R2 unavailable."));

    await expect(runDeletionPass(deps, NOW)).rejects.toThrow("R2 unavailable.");
    expect(removed).toEqual([]);
    expect(audited).toEqual([]);
  });
});
