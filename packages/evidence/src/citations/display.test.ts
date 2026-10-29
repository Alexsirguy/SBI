import { EvidenceSource } from "@sbi/contracts";
import { describe, expect, it } from "vitest";
import { buildClaims } from "../claims/builder";
import type { SupportJudge } from "../claims/judge";
import { saveClaimGraph } from "../claims/persist";
import { createMemoryEvidenceRepositories } from "../memory";
import type { FetchedSource } from "../retrieval/types";
import { US_GOV_LICENSE } from "../retrieval/us-gov";
import { creditLine, excerptDisplay, licenseInfo, QUOTE_LIMIT_CHARS } from "./display";
import { createCitationResolver } from "./resolver";

function source(overrides: Partial<EvidenceSource> = {}): EvidenceSource {
  return EvidenceSource.parse({
    sourceId: "0192f1a0-0000-7000-8000-000000000201",
    title: "Quantifying organismal complexity",
    authors: ["Tenaillon O", "Chao L"],
    doi: "10.1371/journal.pone.0000217",
    sourceType: "peer-reviewed",
    accessedOn: "2026-10-29",
    excerpts: [{ excerptId: "x1", location: "Abstract", text: "A short supporting sentence." }],
    evidenceQuality: "moderate",
    rightsStatus: "reusable",
    lastCheckedAt: "2026-10-29T09:00:00Z",
    retrieval: {
      connector: "crossref",
      fetchedAt: "2026-10-29T09:00:00Z",
      access: "abstract",
      license: "http://creativecommons.org/licenses/by/4.0/",
      contentSha256: "f".repeat(64),
    },
    ...overrides,
  });
}

describe("licenseInfo", () => {
  it.each([
    [
      "http://creativecommons.org/licenses/by/4.0/",
      "CC BY 4.0",
      "https://creativecommons.org/licenses/by/4.0/",
    ],
    [
      "https://creativecommons.org/licenses/by-nc-sa/4.0/",
      "CC BY-NC-SA 4.0",
      "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    ],
    ["cc by", "CC BY", undefined],
    ["cc by-nc", "CC BY-NC", undefined],
    [
      "https://creativecommons.org/publicdomain/zero/1.0/",
      "CC0",
      "https://creativecommons.org/publicdomain/zero/1.0/",
    ],
    [US_GOV_LICENSE, "Public domain (US government work)", undefined],
    ["https://www.springer.com/tdm", "Publisher licence", "https://www.springer.com/tdm"],
  ])("reads %s", (license, label, url) => {
    expect(licenseInfo(license)).toEqual(url ? { label, url } : { label });
  });

  it("returns nothing when no licence was recorded", () => {
    expect(licenseInfo(undefined)).toBeUndefined();
  });
});

describe("creditLine", () => {
  it("names the work, who made it, the licence and when it was accessed", () => {
    expect(creditLine(source())).toBe(
      "Quantifying organismal complexity. Tenaillon O, Chao L. CC BY 4.0. Accessed 2026-10-29.",
    );
  });

  it("prefers the publisher and says when no licence was stated", () => {
    expect(creditLine(source({ publisher: "USGS", retrieval: undefined }))).toBe(
      "Quantifying organismal complexity. USGS. Licence not stated. Accessed 2026-10-29.",
    );
  });
});

describe("excerptDisplay", () => {
  const long = "x".repeat(QUOTE_LIMIT_CHARS + 1);

  it("shows reusable text with credit", () => {
    expect(excerptDisplay(source(), long)).toMatchObject({
      mode: "quote",
      text: long,
      url: "https://doi.org/10.1371/journal.pone.0000217",
      license: { label: "CC BY 4.0" },
    });
  });

  it("shows a quote-only excerpt only while it is a short quotation", () => {
    const quoteOnly = source({ rightsStatus: "quote-only" });
    expect(excerptDisplay(quoteOnly, "Short.").mode).toBe("quote");
    expect(excerptDisplay(quoteOnly, long)).toEqual(expect.objectContaining({ mode: "link" }));
    expect(excerptDisplay(quoteOnly, long)).not.toHaveProperty("text");
  });

  it.each(["link-only", "restricted", "unknown"] as const)("shows only a link for %s", (rights) => {
    expect(excerptDisplay(source({ rightsStatus: rights }), "Short.").mode).toBe("link");
  });
});

describe("quote-only sources in the builder", () => {
  const paragraph = `${"Background on the topic. ".repeat(20)}Ice is less dense than liquid water, so it floats.`;
  const fetched: FetchedSource = {
    title: "A journal article",
    publisher: "Journal",
    authors: ["A"],
    doi: "10.1371/journal.pone.0000999",
    sourceType: "peer-reviewed",
    passages: [{ location: "Abstract", text: paragraph }],
    rightsStatus: "quote-only",
    retrieval: {
      connector: "europe-pmc",
      fetchedAt: "2026-10-29T09:00:00.000Z",
      access: "abstract",
      license: "cc by-nc",
      contentSha256: "a".repeat(64),
    },
  };
  const draft = [
    { key: "ice", text: "Ice is less dense than liquid water.", scope: "water", basic: true },
  ];
  const judge = (quote?: string): SupportJudge => ({
    version: "t",
    judge: async () => ({ verdict: "supports", reason: "ok", quote }),
  });

  it("stores the judge's short quote, not the paragraph, and shows it with credit", async () => {
    const built = await buildClaims(draft, [fetched], {
      judge: judge("Ice is less dense than liquid water, so it floats."),
    });
    expect(paragraph.length).toBeGreaterThan(QUOTE_LIMIT_CHARS);
    expect(built.sources[0]?.excerpts[0]?.text).toBe(
      "Ice is less dense than liquid water, so it floats.",
    );

    const repos = createMemoryEvidenceRepositories();
    const saved = await saveClaimGraph(repos, built);
    const resolved = await createCitationResolver(repos).resolveClaim(
      saved.claims[0]?.claimId ?? "",
    );
    expect(resolved.excerpts[0]?.display).toMatchObject({
      mode: "quote",
      credit: "A journal article. Journal. CC BY-NC. Accessed 2026-10-29.",
    });
  });

  it("does not store a quote-only passage when there is no short quote", async () => {
    for (const quote of [undefined, "x".repeat(QUOTE_LIMIT_CHARS + 1)]) {
      const built = await buildClaims(draft, [fetched], { judge: judge(quote) });
      expect(built.claims).toEqual([]);
      expect(built.sources).toEqual([]);
    }
  });
});
