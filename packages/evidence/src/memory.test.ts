import { join } from "node:path";
import { Claim, EvidenceSource } from "@sbi/contracts";
import { loadFixtures } from "@sbi/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryEvidenceRepositories, type MemoryEvidenceRepositories } from "./memory";

const fixtures = join(import.meta.dirname, "../../contracts/src/fixtures");

function fixture<T>(schema: { parse(input: unknown): T }, contract: string, name: string): T {
  const found = loadFixtures(join(fixtures, contract)).valid.find(
    (item) => item.name === `${name}.json`,
  );
  return schema.parse(found?.data);
}

const source = fixture(EvidenceSource, "evidence-source", "institution-page");
const paper = fixture(EvidenceSource, "evidence-source", "paper-with-doi");
const claim = fixture(Claim, "claim", "supported");

describe("memory evidence repositories", () => {
  let repos: MemoryEvidenceRepositories;

  beforeEach(() => {
    repos = createMemoryEvidenceRepositories();
  });

  it("creates, reads, updates and deletes a source", async () => {
    await repos.sources.save(source);
    expect(await repos.sources.get(source.sourceId)).toEqual(source);

    const rechecked = { ...source, lastCheckedAt: "2026-10-29T08:00:00Z" };
    await repos.sources.save(rechecked);
    expect(await repos.sources.get(source.sourceId)).toEqual(rechecked);

    expect(await repos.sources.delete(source.sourceId)).toBe(true);
    expect(await repos.sources.get(source.sourceId)).toBeUndefined();
    expect(await repos.sources.delete(source.sourceId)).toBe(false);
  });

  it("keeps the excerpt location and rights status it was given", async () => {
    await repos.sources.save(source);
    const stored = await repos.sources.get(source.sourceId);
    expect(stored?.excerpts[0]?.location).toBe("Section 2");
    expect(stored?.rightsStatus).toBe("quote-only");
  });

  it("rejects a source without rights status or excerpt location", async () => {
    const unlicensed: Partial<EvidenceSource> = { ...source, rightsStatus: undefined };
    await expect(repos.sources.save(unlicensed as EvidenceSource)).rejects.toThrow();
    const unlocated = { ...source, excerpts: [{ excerptId: "e1", text: "Some text." }] };
    await expect(repos.sources.save(unlocated as EvidenceSource)).rejects.toThrow();
    expect(await repos.sources.get(source.sourceId)).toBeUndefined();
  });

  it("finds a source by DOI regardless of case, or by URL without its fragment", async () => {
    await repos.sources.save(source);
    await repos.sources.save(paper);

    expect(await repos.sources.findByLocator({ doi: paper.doi?.toUpperCase() })).toEqual(paper);
    expect(await repos.sources.findByLocator({ url: `${source.url}/#section-2` })).toEqual(source);
    expect(await repos.sources.findByLocator({ url: "https://example.org/other" })).toBeUndefined();
  });

  it("fetches in bulk and skips unknown ids", async () => {
    await repos.sources.save(source);
    await repos.claims.save(claim);
    expect(await repos.sources.getMany([source.sourceId, "missing"])).toEqual([source]);
    expect(await repos.claims.getMany([claim.claimId, "missing"])).toEqual([claim]);
  });

  it("deletes a claim", async () => {
    await repos.claims.save(claim);
    expect(await repos.claims.delete(claim.claimId)).toBe(true);
    expect(await repos.claims.get(claim.claimId)).toBeUndefined();
  });

  it("returns copies, so callers cannot change stored records", async () => {
    await repos.sources.save(source);
    const read = await repos.sources.get(source.sourceId);
    read?.excerpts.push({ excerptId: "x", location: "p1", text: "Tampered." });
    expect((await repos.sources.get(source.sourceId))?.excerpts).toHaveLength(1);
  });
});
