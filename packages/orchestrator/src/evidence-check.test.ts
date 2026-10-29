import {
  buildClaims,
  createCitationResolver,
  createMemoryEvidenceRepositories,
  saveClaimGraph,
  type FetchedSource,
} from "@sbi/evidence";
import { describe, expect, it } from "vitest";
import { createEvidenceCheck } from "./evidence-check";
import { makeLesson } from "./lesson-fixture";

function page(publisher: string, url: string): FetchedSource {
  return {
    title: publisher,
    publisher,
    authors: [],
    url,
    sourceType: "institution",
    passages: [{ location: "paragraph 1", text: "Metals expand when heated, so a strip bends." }],
    rightsStatus: "reusable",
    retrieval: {
      connector: "us-gov",
      fetchedAt: "2026-10-29T09:00:00.000Z",
      access: "full-text",
      contentSha256: "c".repeat(64),
    },
  };
}

async function store(sources: FetchedSource[]) {
  const repos = createMemoryEvidenceRepositories();
  const built = await buildClaims(
    [{ key: "expand", text: "Metals expand when heated.", scope: "metals" }],
    sources,
    { judge: { version: "t", judge: async () => ({ verdict: "supports", reason: "ok" }) } },
  );
  const { claims } = await saveClaimGraph(repos, built);
  const check = createEvidenceCheck({
    resolver: createCitationResolver(repos),
    sources: (ids) => repos.sources.getMany(ids),
  });
  const claim = claims[0];
  if (!claim) throw new Error("no claim built");
  const lesson = makeLesson({
    claims: [claim],
    sections: makeLesson().sections.map((section) => ({ ...section, claimIds: [claim.claimId] })),
  });
  return { check, lesson, claim };
}

describe("createEvidenceCheck", () => {
  it("passes a lesson whose claims are stored, cited and twice sourced", async () => {
    const { check, lesson } = await store([
      page("USGS", "https://www.usgs.gov/a"),
      page("NIST", "https://www.nist.gov/b"),
    ]);
    expect(await check.run(lesson)).toEqual({ name: "evidence", passed: true, details: [] });
  });

  it("fails a lesson that changes a stored claim's words", async () => {
    const { check, lesson, claim } = await store([
      page("USGS", "https://www.usgs.gov/a"),
      page("NIST", "https://www.nist.gov/b"),
    ]);
    const altered = { ...lesson, claims: [{ ...claim, text: "Metals shrink when heated." }] };
    const result = await check.run(altered);
    expect(result.passed).toBe(false);
    expect(result.details.join("\n")).toContain("claim-mismatch");
  });

  it("fails claims the store does not hold", async () => {
    const { check } = await store([page("USGS", "https://www.usgs.gov/a")]);
    const result = await check.run(makeLesson());
    expect(result.passed).toBe(false);
    expect(result.details.join("\n")).toContain("unknown-claim");
  });

  it("flags a single-sourced claim shown as supported", async () => {
    const { check, lesson, claim } = await store([page("USGS", "https://www.usgs.gov/a")]);
    const promoted = { ...lesson, claims: [{ ...claim, status: "supported" as const }] };
    const result = await check.run(promoted);
    expect(result.details.join("\n")).toContain("single-source");
  });
});
