import { join } from "node:path";
import { Lesson } from "@sbi/contracts";
import type { DatabaseHandle } from "@sbi/db";
import {
  buildClaims,
  contentSha256,
  createMemoryEvidenceRepositories,
  saveClaimGraph,
  type FetchedSource,
  type Retriever,
} from "@sbi/evidence";
import type { LessonRepository } from "@sbi/orchestrator";
import { loadFixtures } from "@sbi/testing";
import { describe, expect, it, vi } from "vitest";
import { createFreshnessPass } from "./freshness-pass";

function usgs(text: string): FetchedSource {
  const passages = [{ location: "paragraph 1", text }];
  return {
    title: "Water Density",
    authors: [],
    url: "https://www.usgs.gov/water-density",
    sourceType: "institution",
    passages,
    rightsStatus: "reusable",
    retrieval: {
      connector: "us-gov",
      fetchedAt: "2026-09-01T00:00:00.000Z",
      access: "full-text",
      contentSha256: contentSha256(passages),
    },
  };
}

const lessonFixture = Lesson.parse(
  loadFixtures(
    join(import.meta.dirname, "../../../../packages/contracts/src/fixtures/lesson"),
  ).valid.find((item) => item.name === "kettle-full.json")?.data,
);

describe("createFreshnessPass", () => {
  it("runs under the lock and marks lessons on a changed source as stale", async () => {
    const evidence = createMemoryEvidenceRepositories();
    const built = await buildClaims(
      [{ key: "ice", text: "Ice is less dense than liquid water.", scope: "water" }],
      [usgs("Ice is less dense than liquid water, which is why ice floats.")],
      { judge: { version: "t", judge: async () => ({ verdict: "supports", reason: "ok" }) } },
    );
    const { claims } = await saveClaimGraph(evidence, built);
    const lesson: Lesson = { ...lessonFixture, claims: [...lessonFixture.claims, ...claims] };
    const saved: Lesson[] = [];
    const lessons: LessonRepository = {
      save: async (item) => void saved.push(item),
      get: async () => undefined,
      latest: async () => undefined,
      findByIntent: async () => [],
      findByClaimIds: async (ids) => (ids.includes(claims[0]?.claimId ?? "") ? [lesson] : []),
    };
    const retriever: Retriever = {
      retrieve: async () => usgs("Ice has a lower density than water."),
      discover: vi.fn(),
    };
    const locks: string[] = [];
    const database: Pick<DatabaseHandle, "withLock"> = {
      async withLock(name, task) {
        locks.push(name);
        return { acquired: true, value: await task() };
      },
    };

    const pass = createFreshnessPass({
      database,
      repositories: { claims: evidence.claims, evidenceSources: evidence.sources, lessons },
      retriever,
      maxAgeDays: 30,
      batch: 5,
      now: () => new Date("2026-10-29T00:00:00Z"),
    });
    const result = await pass();

    expect(locks).toEqual(["evidence-freshness"]);
    expect(result).toMatchObject({
      acquired: true,
      value: { checked: 1, lessonsMarkedStale: 1, invalidated: [{ reason: "changed", claims: 1 }] },
    });
    expect(saved[0]?.reuse.sourceFreshness).toBe("stale");
  });
});
