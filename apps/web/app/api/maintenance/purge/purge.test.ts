import { describe, expect, it } from "vitest";
import { isAuthorized, runPurge } from "./purge";

describe("isAuthorized", () => {
  it("accepts only the exact bearer token", () => {
    expect(isAuthorized("Bearer secret", "secret")).toBe(true);
    expect(isAuthorized("Bearer wrong", "secret")).toBe(false);
    expect(isAuthorized(null, "secret")).toBe(false);
    expect(isAuthorized("Bearer secret", undefined)).toBe(false);
  });
});

describe("runPurge", () => {
  it("deletes through the registry, storage, and audit log", async () => {
    const stored: string[] = [];
    const removed: string[] = [];
    const audited: string[] = [];
    const result = await runPurge(
      {
        audit: {
          record(entry) {
            audited.push(entry.key);
            return Promise.resolve();
          },
        },
        registry: {
          listExpired: () =>
            Promise.resolve([
              {
                createdAt: new Date("2026-01-01T00:00:00Z"),
                key: "uploads/old.jpg",
                kind: "original" as const,
                savedByUser: false,
              },
            ]),
          remove(keys) {
            removed.push(...keys);
            return Promise.resolve();
          },
        },
        storage: {
          remove(keys) {
            stored.push(...keys);
            return Promise.resolve();
          },
        },
      },
      new Date("2026-02-01T00:00:00Z"),
    );

    expect(result).toEqual({ deleted: ["uploads/old.jpg"] });
    expect(stored).toEqual(["uploads/old.jpg"]);
    expect(removed).toEqual(["uploads/old.jpg"]);
    expect(audited).toEqual(["uploads/old.jpg"]);
  });
});
