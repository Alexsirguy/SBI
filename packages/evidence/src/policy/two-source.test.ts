import { Claim, EvidenceSource } from "@sbi/contracts";
import { describe, expect, it } from "vitest";
import { buildClaims } from "../claims/builder";
import type { SupportJudge } from "../claims/judge";
import type { FetchedSource } from "../retrieval/types";
import {
  applySourcePolicy,
  checkSourcePolicy,
  independentSourceCount,
  SINGLE_SOURCE_NOTE,
  SINGLE_STUDY_LIMITATION,
  STUDIES_LIMITATION,
} from "./two-source";

let next = 0;
const uuid = () => `0192f1a0-0000-7000-8000-${String((next += 1)).padStart(12, "0")}`;

function source(overrides: Partial<EvidenceSource>): EvidenceSource {
  return EvidenceSource.parse({
    sourceId: uuid(),
    title: "A source",
    url: "https://example.org/page",
    sourceType: "institution",
    accessedOn: "2026-10-29",
    excerpts: [{ excerptId: "x1", location: "p1", text: "Water boils at 100 °C at sea level." }],
    evidenceQuality: "high",
    rightsStatus: "reusable",
    lastCheckedAt: "2026-10-29T09:00:00Z",
    ...overrides,
  });
}

function claimOn(sources: EvidenceSource[], overrides: Partial<Claim> = {}): Claim {
  return Claim.parse({
    claimId: uuid(),
    text: "Water boils at 100 °C at sea level.",
    status: "supported",
    sourceIds: sources.map((item) => item.sourceId),
    citations: sources.map((item) => ({ sourceId: item.sourceId, excerptId: "x1" })),
    scope: "pure water",
    confidence: "high",
    ...overrides,
  });
}

const usgs = () => source({ publisher: "U.S. Geological Survey", url: "https://www.usgs.gov/a" });
const nist = () =>
  source({
    publisher: "National Institute of Standards and Technology",
    url: "https://www.nist.gov/b",
  });
const paper = (doi: string, authors: string[], studyDesign?: EvidenceSource["studyDesign"]) =>
  source({
    doi,
    url: undefined,
    authors,
    sourceType: "peer-reviewed",
    studyDesign,
    publisher: "PLoS One",
  });

describe("independentSourceCount", () => {
  it("counts different publishers separately", () => {
    expect(independentSourceCount([usgs(), nist()])).toBe(2);
  });

  it("counts two pages from one publisher once", () => {
    expect(independentSourceCount([usgs(), usgs()])).toBe(1);
  });

  it("falls back to the host when a page names no publisher", () => {
    const a = source({ url: "https://www.nasa.gov/a" });
    const b = source({ url: "https://nasa.gov/b" });
    expect(independentSourceCount([a, b])).toBe(1);
  });

  it("counts papers in one journal separately unless they share an author", () => {
    expect(
      independentSourceCount([paper("10.1371/a", ["Tenaillon O"]), paper("10.1371/b", ["Chao L"])]),
    ).toBe(2);
    expect(
      independentSourceCount([
        paper("10.1371/a", ["Tenaillon O", "Chao L"]),
        paper("10.1371/b", ["Chao L"]),
      ]),
    ).toBe(1);
  });

  it("counts the same DOI once", () => {
    expect(independentSourceCount([paper("10.1371/A", ["X"]), paper("10.1371/a", ["Y"])])).toBe(1);
  });
});

describe("checkSourcePolicy", () => {
  it("flags a non-trivial claim supported by a single source", () => {
    const only = usgs();
    const claim = claimOn([only]);
    expect(checkSourcePolicy([claim], [only])).toEqual([
      { kind: "single-source", claimId: claim.claimId, independentSources: 1 },
    ]);
  });

  it("flags two sources from the same publisher as single-sourced", () => {
    const pages = [usgs(), usgs()];
    expect(checkSourcePolicy([claimOn(pages)], pages)[0]?.kind).toBe("single-source");
  });

  it("accepts two independent sources, a basic claim, or a claim already qualified", () => {
    const pages = [usgs(), nist()];
    const only = [usgs()];
    expect(checkSourcePolicy([claimOn(pages)], pages)).toEqual([]);
    expect(checkSourcePolicy([claimOn(only, { significance: "basic" })], only)).toEqual([]);
    expect(
      checkSourcePolicy(
        [claimOn(only, { status: "qualified", uncertainty: SINGLE_SOURCE_NOTE })],
        only,
      ),
    ).toEqual([]);
  });

  it("ignores open questions", () => {
    const claim = Claim.parse({
      claimId: uuid(),
      text: "Does salt change how fast water boils?",
      status: "unsupported",
      scope: "cooking",
      confidence: "low",
      uncertainty: "No source yet.",
    });
    expect(checkSourcePolicy([claim], [])).toEqual([]);
  });

  it("requires a limitation note on claims that rest only on primary studies", () => {
    const studies = [paper("10.1371/a", ["A"], "primary-study"), paper("10.1371/b", ["B"])];
    const claim = claimOn(studies);
    expect(checkSourcePolicy([claim], studies)).toEqual([
      { kind: "missing-limitation", claimId: claim.claimId },
    ]);
    expect(checkSourcePolicy([{ ...claim, limitations: STUDIES_LIMITATION }], studies)).toEqual([]);
  });

  it("needs no limitation when a review or reference source also supports the claim", () => {
    const mixed = [paper("10.1371/a", ["A"], "primary-study"), paper("10.1371/r", ["R"], "review")];
    const withAgency = [paper("10.1371/a", ["A"], "primary-study"), nist()];
    expect(checkSourcePolicy([claimOn(mixed)], mixed)).toEqual([]);
    expect(checkSourcePolicy([claimOn(withAgency)], withAgency)).toEqual([]);
  });
});

describe("applySourcePolicy", () => {
  it("qualifies a single-sourced claim and explains why", () => {
    const only = [usgs()];
    expect(applySourcePolicy(claimOn(only), only)).toMatchObject({
      status: "qualified",
      confidence: "medium",
      uncertainty: SINGLE_SOURCE_NOTE,
    });
  });

  it("explains the limits of a single study", () => {
    const study = [paper("10.1371/a", ["A"], "primary-study")];
    const applied = applySourcePolicy(claimOn(study, { significance: "basic" }), study);
    expect(applied).toMatchObject({ status: "supported", limitations: SINGLE_STUDY_LIMITATION });
    expect(checkSourcePolicy([applied], study)).toEqual([]);
  });
});

describe("buildClaims with the policy", () => {
  const judge: SupportJudge = {
    version: "t",
    judge: async () => ({ verdict: "supports", reason: "ok" }),
  };
  const fetched = (
    publisher: string,
    url: string,
    extra: Partial<FetchedSource> = {},
  ): FetchedSource => ({
    title: publisher,
    publisher,
    authors: [],
    url,
    sourceType: "institution",
    passages: [{ location: "p1", text: "Water boils at 100 °C at sea level." }],
    rightsStatus: "reusable",
    retrieval: {
      connector: "us-gov",
      fetchedAt: "2026-10-29T09:00:00.000Z",
      access: "full-text",
      contentSha256: "d".repeat(64),
    },
    ...extra,
  });
  const draft = { key: "boil", text: "Water boils at 100 °C at sea level.", scope: "pure water" };

  it("qualifies a claim with one source and supports one with two independent sources", async () => {
    const one = await buildClaims([draft], [fetched("USGS", "https://www.usgs.gov/a")], { judge });
    expect(one.claims[0]).toMatchObject({ status: "qualified", uncertainty: SINGLE_SOURCE_NOTE });

    const two = await buildClaims(
      [draft],
      [fetched("USGS", "https://www.usgs.gov/a"), fetched("NIST", "https://www.nist.gov/b")],
      { judge },
    );
    expect(two.claims[0]).toMatchObject({ status: "supported", confidence: "high" });
    expect(checkSourcePolicy(two.claims, two.sources)).toEqual([]);
  });

  it("adds a limitation note when the support is one study", async () => {
    const study = fetched("PLoS One", "https://doi.org/10.1371/a", {
      doi: "10.1371/a",
      authors: ["A"],
      sourceType: "peer-reviewed",
      studyDesign: "primary-study",
    });
    const built = await buildClaims([{ ...draft, basic: true }], [study], { judge });
    expect(built.claims[0]?.limitations).toBe(SINGLE_STUDY_LIMITATION);
    expect(built.sources[0]?.studyDesign).toBe("primary-study");
  });
});
