import type { EvidenceInvalidated, EvidenceSource } from "@sbi/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildClaims } from "../claims/builder";
import type { SupportJudge } from "../claims/judge";
import { saveClaimGraph } from "../claims/persist";
import { createMemoryEvidenceRepositories, type MemoryEvidenceRepositories } from "../memory";
import { SourceFetchError } from "../retrieval/http";
import { type Retriever, UntrustedSourceError } from "../retrieval/retriever";
import { contentSha256 } from "../retrieval/text";
import type { FetchedSource, Passage } from "../retrieval/types";
import { checkSource, runFreshnessPass } from "./freshness";

const FETCHED_AT = "2026-09-01T09:00:00.000Z";
const NOW = new Date("2026-10-29T09:00:00Z");

function page(
  passages: Passage[],
  rightsStatus: FetchedSource["rightsStatus"] = "reusable",
): FetchedSource {
  return {
    title: "Water Density",
    publisher: "U.S. Geological Survey",
    authors: [],
    url: "https://www.usgs.gov/water-density",
    sourceType: "institution",
    passages,
    rightsStatus,
    retrieval: {
      connector: "us-gov",
      fetchedAt: FETCHED_AT,
      access: "full-text",
      contentSha256: contentSha256(passages),
    },
  };
}

const ORIGINAL = [
  {
    location: "paragraph 1",
    text: "Ice is less dense than liquid water, which is why ice floats.",
  },
  { location: "paragraph 2", text: "Water boils at 100 °C at sea level." },
];

const supportsAll: SupportJudge = {
  version: "always",
  judge: async () => ({ verdict: "supports", reason: "ok" }),
};

function retrieverReturning(result: FetchedSource | Error): Retriever {
  return {
    retrieve: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    }),
    discover: vi.fn(),
  };
}

describe("source freshness", () => {
  let repos: MemoryEvidenceRepositories;
  let source: EvidenceSource;
  let claimIds: Record<string, string>;
  let events: EvidenceInvalidated[];
  const sink = { publish: async (event: EvidenceInvalidated) => void events.push(event) };

  beforeEach(async () => {
    repos = createMemoryEvidenceRepositories();
    events = [];
    const built = await buildClaims(
      [
        {
          key: "ice",
          text: "Ice floats because it is less dense than liquid water.",
          scope: "water",
        },
        { key: "lakes", text: "Ice floats on liquid water.", scope: "lakes", dependsOn: ["ice"] },
      ],
      [page(ORIGINAL)],
      { judge: supportsAll },
    );
    const saved = await saveClaimGraph(repos, built);
    source = saved.sources[0] as EvidenceSource;
    claimIds = built.ids;
  });

  const pass = (retriever: Retriever, now = NOW) =>
    runFreshnessPass({ repositories: repos, retriever, sink, now, maxAgeDays: 30, limit: 10 });

  it("keeps a source whose content is unchanged and records the check", async () => {
    const retriever = retrieverReturning(page(ORIGINAL));
    const result = await pass(retriever);

    expect(result).toMatchObject({ checked: 1, current: 1, invalidated: [] });
    expect(events).toEqual([]);
    const stored = await repos.sources.get(source.sourceId);
    expect(stored?.lastCheckedAt).toBe(NOW.toISOString());
    expect(stored?.freshness).toEqual({
      status: "current",
      checkedAt: NOW.toISOString(),
      missingExcerptIds: [],
    });
    expect(vi.mocked(retriever.retrieve).mock.calls[0]).toEqual([
      { doi: undefined, url: "https://www.usgs.gov/water-density" },
      { signal: undefined, prefer: "us-gov" },
    ]);
  });

  it("stays current when other text changed but the cited words still appear", async () => {
    const edited = [{ location: "paragraph 1", text: `New intro. ${ORIGINAL[0]?.text}` }];
    expect((await checkSource(source, retrieverReturning(page(edited)), { now: NOW })).status).toBe(
      "current",
    );
  });

  it("invalidates the citing claims and their dependents when a cited excerpt disappears", async () => {
    const rewritten = [{ location: "paragraph 1", text: "Ice has a lower density than water." }];
    const result = await pass(retrieverReturning(page(rewritten)));

    expect(result.invalidated).toEqual([
      { sourceId: source.sourceId, reason: "changed", claims: 2 },
    ]);
    expect(events).toEqual([
      {
        type: "evidence.invalidated",
        sourceId: source.sourceId,
        reason: "changed",
        claimIds: [claimIds.ice, claimIds.lakes],
        detectedAt: NOW.toISOString(),
      },
    ]);
    const stored = await repos.sources.get(source.sourceId);
    expect(stored?.freshness).toMatchObject({ status: "changed", missingExcerptIds: ["x1"] });
    expect(stored?.excerpts).toEqual(source.excerpts);
  });

  it("reports a source that now answers 404 as gone", async () => {
    await pass(retrieverReturning(new SourceFetchError("missing", 404)));
    expect(events.map((event) => event.reason)).toEqual(["gone"]);
  });

  it("treats a source no connector trusts any more as gone", async () => {
    await pass(retrieverReturning(new UntrustedSourceError({ url: "https://www.usgs.gov/x" })));
    expect(events.map((event) => event.reason)).toEqual(["gone"]);
  });

  it("invalidates when the licence becomes more restrictive, not less", async () => {
    await pass(retrieverReturning(page(ORIGINAL, "quote-only")));
    expect(events.map((event) => event.reason)).toEqual(["rights-changed"]);
    expect((await repos.sources.get(source.sourceId))?.rightsStatus).toBe("quote-only");
  });

  it("does not report the same change twice", async () => {
    const rewritten = page([{ location: "paragraph 1", text: "Something else entirely." }]);
    await pass(retrieverReturning(rewritten));
    await pass(retrieverReturning(rewritten), new Date(NOW.getTime() + 31 * 86_400_000));
    expect(events).toHaveLength(1);
  });

  it("retries a failing source the next day without invalidating anything", async () => {
    const result = await pass(retrieverReturning(new SourceFetchError("timeout")));
    expect(result).toMatchObject({ errors: 1, invalidated: [] });
    expect(events).toEqual([]);
    const stored = await repos.sources.get(source.sourceId);
    expect(stored?.lastCheckedAt).toBe("2026-09-30T09:00:00.000Z");
    expect(stored?.freshness).toBeUndefined();

    const tomorrow = new Date(NOW.getTime() + 86_400_000 + 1);
    expect((await pass(retrieverReturning(page(ORIGINAL)), tomorrow)).checked).toBe(1);
  });

  it("skips sources checked within the maximum age", async () => {
    await repos.sources.save({ ...source, lastCheckedAt: "2026-10-20T00:00:00Z" });
    expect((await pass(retrieverReturning(page(ORIGINAL)))).checked).toBe(0);
  });
});
