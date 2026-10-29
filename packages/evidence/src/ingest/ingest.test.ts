import { describe, expect, it, vi } from "vitest";
import type { SupportJudge } from "../claims/judge";
import { saveClaimGraph } from "../claims/persist";
import { buildClaims } from "../claims/builder";
import { createMemoryEvidenceRepositories } from "../memory";
import { DuplicateSourceError } from "../repositories";
import type { Retriever } from "../retrieval/retriever";
import type { FetchedSource } from "../retrieval/types";
import { ingestTopic } from "./ingest";

const judge: SupportJudge = {
  version: "t",
  judge: async () => ({ verdict: "supports", reason: "ok" }),
};

function page(publisher: string, url: string, text: string): FetchedSource {
  return {
    title: publisher,
    publisher,
    authors: [],
    url,
    sourceType: "institution",
    passages: [{ location: "paragraph 1", text }],
    rightsStatus: "reusable",
    retrieval: {
      connector: "us-gov",
      fetchedAt: "2026-10-29T09:00:00.000Z",
      access: "full-text",
      contentSha256: "e".repeat(64),
    },
  };
}

const USGS = page(
  "USGS",
  "https://www.usgs.gov/ice",
  "Ice is less dense than liquid water, so it floats.",
);
const NOAA = page(
  "NOAA",
  "https://www.noaa.gov/ice",
  "Because ice is less dense than liquid water, it floats.",
);

function retriever(): Retriever {
  return {
    discover: vi.fn(async () => ({
      fetched: [USGS],
      failed: [{ ref: { doi: "10.1000/x" }, reason: "404" }],
    })),
    retrieve: vi.fn(async (ref) => {
      if (ref.url === NOAA.url) return NOAA;
      throw new Error("offline");
    }),
  };
}

const spec = {
  topic: "ice",
  wikipedia: ["Ice"],
  refs: [{ url: NOAA.url }, { url: "https://www.nasa.gov/missing" }],
  drafts: [
    {
      key: "floats",
      text: "Ice floats because it is less dense than liquid water.",
      scope: "water",
    },
    { key: "unicorns", text: "Unicorns drink only melted glacier ice.", scope: "myth" },
  ],
};

describe("ingestTopic", () => {
  it("discovers, fetches, builds and stores, and reports what it could not source", async () => {
    const repositories = createMemoryEvidenceRepositories();
    let locks = 0;
    const lock = <T>(task: () => Promise<T>) => {
      locks += 1;
      return task();
    };

    const report = await ingestTopic(spec, { retriever: retriever(), judge, repositories, lock });

    expect(report.sources.map((source) => source.title).sort()).toEqual(["NOAA", "USGS"]);
    expect(report.failed.map((failure) => failure.reason)).toEqual(["404", "offline"]);
    expect(report.claims).toEqual([
      { key: "floats", claimId: expect.any(String), status: "supported" },
    ]);
    expect(report.removed.map((item) => item.key)).toEqual(["unicorns"]);
    expect(locks).toBe(1);
    const stored = await repositories.claims.get(report.claims[0]?.claimId ?? "");
    expect(stored?.sourceIds).toHaveLength(2);
  });

  it("rejects a topic with no drafts or an empty ref", async () => {
    const options = {
      retriever: retriever(),
      judge,
      repositories: createMemoryEvidenceRepositories(),
    };
    await expect(ingestTopic({ ...spec, drafts: [] }, options)).rejects.toThrow();
    await expect(ingestTopic({ ...spec, refs: [{}] }, options)).rejects.toThrow();
  });

  it("running a topic twice keeps one record per source", async () => {
    const repositories = createMemoryEvidenceRepositories();
    await ingestTopic(spec, { retriever: retriever(), judge, repositories });
    const second = await ingestTopic(spec, { retriever: retriever(), judge, repositories });
    const ids = await Promise.all(
      [USGS, NOAA].map(
        async (source) => (await repositories.sources.findByLocator(source))?.sourceId,
      ),
    );
    expect(new Set(second.claims.map((claim) => claim.claimId)).size).toBe(1);
    expect(ids.every(Boolean)).toBe(true);
    const stored = await repositories.sources.findByLocator(USGS);
    expect(stored?.claimIds).toHaveLength(2);
  });
});

describe("duplicate sources", () => {
  it("refuses a second record for a known DOI or URL", async () => {
    const repositories = createMemoryEvidenceRepositories();
    const built = await buildClaims(
      [
        {
          key: "floats",
          text: "Ice floats because it is less dense than liquid water.",
          scope: "water",
          basic: true,
        },
      ],
      [USGS],
      { judge },
    );
    const [source] = built.sources;
    await repositories.sources.save(source as NonNullable<typeof source>);
    await expect(
      repositories.sources.save({
        ...(source as NonNullable<typeof source>),
        sourceId: "0192f1a0-0000-7000-8000-0000000000ee",
      }),
    ).rejects.toBeInstanceOf(DuplicateSourceError);
  });

  it("merges into the winner when another build stored the source first", async () => {
    const repositories = createMemoryEvidenceRepositories();
    const draft = (text: string) => [{ key: "k", text, scope: "water", basic: true }];
    const first = await buildClaims(draft("Ice is less dense than liquid water."), [USGS], {
      judge,
    });
    const second = await buildClaims(draft("Ice floats on liquid water."), [USGS], { judge });
    const winner = await saveClaimGraph(repositories, first);

    // The second build looked the source up before the first one saved it.
    let stale = true;
    const racing = {
      ...repositories,
      sources: {
        ...repositories.sources,
        findByLocator: async (
          locator: Parameters<typeof repositories.sources.findByLocator>[0],
        ) => {
          if (stale) {
            stale = false;
            return undefined;
          }
          return repositories.sources.findByLocator(locator);
        },
      },
    };
    const loser = await saveClaimGraph(racing, second);

    expect(loser.sources[0]?.sourceId).toBe(winner.sources[0]?.sourceId);
    expect(loser.claims[0]?.sourceIds).toEqual([winner.sources[0]?.sourceId]);
  });
});
