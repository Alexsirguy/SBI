import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EvidenceSource } from "@sbi/contracts";
import { licenseInfo } from "../citations/display";
import { describe, expect, it, vi } from "vitest";
import { createCrossrefConnector, fullDate } from "./crossref";
import { createEuropePmcConnector } from "./europe-pmc";
import { getText, SourceFetchError, USER_AGENT, userAgentWith } from "./http";
import {
  createDefaultRetriever,
  createRetriever,
  toEvidenceSource,
  UntrustedSourceError,
} from "./retriever";
import { rightsFromLicense } from "./rights";
import { abstractPassages, htmlParagraphs, htmlTablePassages, jatsPassages } from "./text";
import { createInstitutionConnector, institutionFor } from "./institutions";
import { discoverReferences, refFromLink } from "./wikipedia";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
const now = () => new Date("2026-10-29T09:00:00Z");
const USGS = "https://www.usgs.gov/special-topics/water-science-school/science/water-density";

type Route = [RegExp, () => Response];

function fakeFetch(routes: Route[]) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    const route = routes.find(([pattern]) => pattern.test(url));
    const response = route ? route[1]() : new Response("not found", { status: 404 });
    Object.defineProperty(response, "url", { value: url });
    return response;
  });
}

const json = (name: string) => () => new Response(fixture(name), { status: 200 });

const ROUTES: Route[] = [
  [/api\.crossref\.org\/works\/10\.1371/, json("crossref-work.json")],
  [/europepmc.*DOI%3A%2210\.1371/, json("europe-pmc-search.json")],
  [/europepmc.*EXT_ID%3A10066724/, json("europe-pmc-search.json")],
  [/europepmc/, () => new Response(JSON.stringify({ resultList: { result: [] } }))],
  [/wikipedia\.org/, json("wikipedia-externallinks.json")],
  [/usgs\.gov/, () => new Response(fixture("usgs-water-density.html"))],
];

const http = (fetchImpl: typeof fetch) => ({ fetchImpl, now, sleep: () => Promise.resolve() });

describe("Crossref connector", () => {
  it("records identity, date, access and rights for the fetch", async () => {
    const connector = createCrossrefConnector(http(fakeFetch(ROUTES)));
    const source = await connector.fetch({ doi: "10.1371/journal.pone.0000217" });

    expect(source).toMatchObject({
      doi: "10.1371/journal.pone.0000217",
      publisher: "Public Library of Science (PLoS)",
      sourceType: "peer-reviewed",
      publishedOn: "2007-02-14",
      rightsStatus: "reusable",
      retrieval: {
        connector: "crossref",
        fetchedAt: "2026-10-29T09:00:00.000Z",
        access: "abstract",
        license: "http://creativecommons.org/licenses/by/4.0/",
      },
    });
    expect(source.passages[0]?.location).toBe("Abstract");
    expect(source.retrieval.contentSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("marks a work with no abstract as metadata-only and link-only", async () => {
    const body = JSON.parse(fixture("crossref-work.json"));
    delete body.message.abstract;
    const connector = createCrossrefConnector(
      http(fakeFetch([[/crossref/, () => new Response(JSON.stringify(body))]])),
    );
    const source = await connector.fetch({ doi: "10.1371/journal.pone.0000217" });
    expect(source.passages).toEqual([]);
    expect(source.rightsStatus).toBe("link-only");
    expect(source.retrieval.access).toBe("metadata-only");
  });

  it("keeps only full dates", () => {
    expect(fullDate([2007, 2, 14])).toBe("2007-02-14");
    expect(fullDate([2007])).toBeUndefined();
  });
});

describe("Europe PMC connector", () => {
  it("splits the abstract at its headings and reads the licence", async () => {
    const connector = createEuropePmcConnector(http(fakeFetch(ROUTES)));
    const source = await connector.fetch({ doi: "10.1371/journal.pone.0000217" });

    expect(source.title).toBe(
      "Quantifying organismal complexity using a population genetic approach",
    );
    expect(source.authors).toEqual(["Tenaillon O", "Silander OK", "Uzan JP", "Chao L"]);
    expect(source.passages.map((passage) => passage.location)).toEqual([
      "Abstract, Background",
      "Abstract, Methodology",
      "Abstract, Conclusions/significance",
    ]);
    expect(source.rightsStatus).toBe("reusable");
    expect(source.retrieval).toMatchObject({ connector: "europe-pmc", license: "cc by" });
    expect(source.studyDesign).toBe("primary-study");
  });

  it("reads a review as a review, not a single study", async () => {
    const body = JSON.parse(fixture("europe-pmc-search.json"));
    body.resultList.result[0].pubTypeList.pubType = ["Review", "Journal Article"];
    const connector = createEuropePmcConnector(
      http(fakeFetch([[/europepmc/, () => new Response(JSON.stringify(body))]])),
    );
    expect((await connector.fetch({ doi: "10.1371/journal.pone.0000217" })).studyDesign).toBe(
      "review",
    );
  });

  it("reads open-access full text, including table rows, after the abstract", async () => {
    const connector = createEuropePmcConnector(
      http(
        fakeFetch([
          [/fullTextXML/, () => new Response(fixture("europe-pmc-fulltext.xml"))],
          ...ROUTES,
        ]),
      ),
    );
    const source = await connector.fetch({ doi: "10.1371/journal.pone.0000217" });
    const locations = source.passages.map((passage) => passage.location);
    expect(source.retrieval.access).toBe("full-text");
    expect(locations.slice(0, 4)).toEqual([
      "Abstract, Background",
      "Abstract, Methodology",
      "Abstract, Conclusions/significance",
      "Introduction, paragraph 1",
    ]);
    expect(locations).toContain("A nested subsection, paragraph 1");
    expect(source.passages.find((passage) => passage.location.endsWith("row 2"))?.text).toMatch(
      /^Table 1 \(Sample surfaces.*\): Sample Surface: Normal SiO2; Drop Contact Angle: 33\.4/,
    );
    expect(source.passages.map((passage) => passage.text).join(" ")).not.toContain(
      "figure caption",
    );
  });

  it("keeps the abstract when full text is not open or fails", async () => {
    const body = JSON.parse(fixture("europe-pmc-search.json"));
    body.resultList.result[0].license = "cc by-nc";
    const failing = createEuropePmcConnector(
      http(
        fakeFetch([
          [/fullTextXML/, () => new Response("down", { status: 500 })],
          [/europepmc/, () => new Response(fixture("europe-pmc-search.json"))],
        ]),
      ),
    );
    expect((await failing.fetch({ doi: "10.1371/journal.pone.0000217" })).retrieval.access).toBe(
      "abstract",
    );
    const fullText = vi.fn(() => new Response(fixture("europe-pmc-fulltext.xml")));
    body.resultList.result[0].isOpenAccess = "N";
    const closed = createEuropePmcConnector(
      http(
        fakeFetch([
          [/fullTextXML/, fullText],
          [/europepmc/, () => new Response(JSON.stringify(body))],
        ]),
      ),
    );
    expect((await closed.fetch({ doi: "10.1371/journal.pone.0000217" })).retrieval.access).toBe(
      "abstract",
    );
    expect(fullText).not.toHaveBeenCalled();
  });

  it("reports a missing record as a 404", async () => {
    const connector = createEuropePmcConnector(http(fakeFetch(ROUTES)));
    await expect(connector.fetch({ pmid: "1" })).rejects.toMatchObject({ status: 404 });
  });
});

describe("institution registry", () => {
  it.each([
    ["https://www.fda.gov/consumers/consumer-updates/x", "U.S. Food and Drug Administration"],
    ["https://www.ars.usda.gov/news-events/x", "USDA Agricultural Research Service"],
    ["https://www.usda.gov/topics/x", "U.S. Department of Agriculture"],
    ["https://www.gov.uk/guidance/x", "GOV.UK"],
    ["https://joint-research-centre.ec.europa.eu/x", "European Commission"],
    ["https://www.ga.gov.au/education/x", "Geoscience Australia"],
    ["https://www.eso.org/public/news/eso2601/", "European Southern Observatory"],
  ])("credits %s to %s", (url, publisher) => {
    expect(institutionFor(url)?.publisher).toBe(publisher);
  });

  it.each([
    "https://catalog.archives.gov/id/123",
    "https://ppubs.uspto.gov/pubwebapp/",
    "https://www.eso.org/public/about-eso/",
    "https://europa.eu/european-union/x",
    "https://www.llnl.gov/news/x",
    "https://www.csiro.au/en/research/x",
  ])("refuses %s", (url) => {
    expect(institutionFor(url)).toBeUndefined();
  });

  it("labels the UK licence for credit lines", () => {
    expect(licenseInfo(institutionFor("https://www.gov.uk/x")?.grant.license)).toEqual({
      label: "Open Government Licence v3.0",
      url: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
    });
  });
});

describe("US government connector", () => {
  it("accepts only https pages on allowlisted federal science domains", () => {
    expect(institutionFor(USGS)?.domain).toBe("usgs.gov");
    expect(institutionFor("https://science.nasa.gov/sun")?.domain).toBe("nasa.gov");
    expect(institutionFor("https://home.nps.gov/romo/learn/nature/fall.htm")?.domain).toBe(
      "nps.gov",
    );
    expect(institutionFor("https://www.energy.gov/energysaver/heating")?.domain).toBe("energy.gov");
    expect(institutionFor("http://www.usgs.gov/page")).toBeUndefined();
    expect(institutionFor("https://usgs.gov.example.com/page")).toBeUndefined();
    expect(institutionFor("https://pubmed.ncbi.nlm.nih.gov/10066724")).toBeUndefined();
    expect(institutionFor("https://www.whitehouse.gov/")).toBeUndefined();
  });

  it("keeps body paragraphs and drops site chrome and scripts", async () => {
    const connector = createInstitutionConnector(http(fakeFetch(ROUTES)));
    const source = await connector.fetch({ url: USGS });

    expect(source.title).toBe("Water Density");
    expect(source.publisher).toBe("U.S. Geological Survey");
    expect(source.studyDesign).toBe("not-research");
    expect(source.rightsStatus).toBe("reusable");
    expect(source.retrieval.access).toBe("full-text");
    const text = source.passages.map((passage) => passage.text).join("\n");
    expect(text).toContain("0.9998395 g/ml at 4.0° Celsius");
    expect(text).not.toMatch(
      /official website|Related content|Department of the Interior|not content/,
    );
    expect(text).not.toContain("Water Science School HOME");
    expect(source.passages[0]?.location).toBe("paragraph 1");
  });

  it("refuses a page that redirects off the allowlist", async () => {
    const fetchImpl = vi.fn(async () => {
      const response = new Response(fixture("usgs-water-density.html"));
      Object.defineProperty(response, "url", { value: "https://example.com/landing" });
      return response;
    });
    const connector = createInstitutionConnector(http(fetchImpl));
    await expect(connector.fetch({ url: USGS })).rejects.toThrow(/outside the allowlist/);
  });
});

describe("Wikipedia discovery", () => {
  it("returns only trusted references: DOIs, PubMed ids and federal pages", async () => {
    const refs = await discoverReferences("Boiling point", http(fakeFetch(ROUTES)));
    expect(refs).toEqual([
      { doi: "10.1351/pac198254061239" },
      { doi: "10.1152/jappl.1999.86.3.1062" },
      { pmid: "10066724" },
    ]);
  });

  it("drops links it cannot route to a trusted connector", () => {
    expect(refFromLink("https://en.wikipedia.org/wiki/Boiling_point")).toBeUndefined();
    expect(refFromLink("https://www.engineeringtoolbox.com/boiling.html")).toBeUndefined();
    expect(refFromLink("https://doi.org/not-a-doi")).toBeUndefined();
    expect(refFromLink("https://www.nist.gov/pml")).toEqual({ url: "https://www.nist.gov/pml" });
  });
});

describe("retriever", () => {
  it("never fetches Wikipedia or other untrusted pages as evidence", async () => {
    const retriever = createDefaultRetriever(http(fakeFetch(ROUTES)));
    await expect(
      retriever.retrieve({ url: "https://en.wikipedia.org/wiki/Boiling_point" }),
    ).rejects.toBeInstanceOf(UntrustedSourceError);
    await expect(retriever.retrieve({ url: "https://example.org/kettles" })).rejects.toBeInstanceOf(
      UntrustedSourceError,
    );
  });

  it("falls back to the next connector that can fetch the ref", async () => {
    const retriever = createDefaultRetriever(
      http(fakeFetch([[/europepmc/, () => new Response("down", { status: 500 })], ...ROUTES])),
    );
    const source = await retriever.retrieve({ doi: "10.1371/journal.pone.0000217" });
    expect(source.retrieval.connector).toBe("crossref");
  });

  it("follows Wikipedia's references and reports the ones it could not fetch", async () => {
    const retriever = createDefaultRetriever(http(fakeFetch(ROUTES)));
    const { fetched, failed } = await retriever.discover("Boiling point");
    expect(fetched.map((source) => source.retrieval.connector)).toEqual(["europe-pmc"]);
    expect(failed.map((failure) => failure.ref)).toEqual([
      { doi: "10.1351/pac198254061239" },
      { doi: "10.1152/jappl.1999.86.3.1062" },
    ]);
  });

  it("caps how many references it follows", async () => {
    const connector = {
      id: "fake",
      canFetch: () => true,
      fetch: vi.fn(async () => {
        throw new Error("offline");
      }),
    };
    const retriever = createRetriever({
      connectors: [connector],
      discoverRefs: async () => Array.from({ length: 20 }, (_, index) => ({ pmid: String(index) })),
      maxSources: 3,
    });
    await retriever.discover("Anything");
    expect(connector.fetch).toHaveBeenCalledTimes(3);
  });
});

describe("toEvidenceSource", () => {
  it("stores the chosen passages with the fetch record", async () => {
    const fetched = await createInstitutionConnector(http(fakeFetch(ROUTES))).fetch({ url: USGS });
    const source = toEvidenceSource(fetched, { passages: fetched.passages.slice(0, 1) });

    expect(EvidenceSource.parse(source)).toEqual(source);
    expect(source).toMatchObject({
      accessedOn: "2026-10-29",
      lastCheckedAt: "2026-10-29T09:00:00.000Z",
      evidenceQuality: "high",
      excerpts: [{ excerptId: "x1", location: "paragraph 1" }],
      retrieval: { connector: "institution", access: "full-text" },
    });
  });
});

describe("rightsFromLicense", () => {
  it.each([
    ["http://creativecommons.org/licenses/by/4.0/", "reusable"],
    ["cc by", "reusable"],
    ["cc by-sa", "reusable"],
    ["https://creativecommons.org/publicdomain/zero/1.0/", "reusable"],
    ["cc by-nc", "quote-only"],
    ["http://creativecommons.org/licenses/by-nc-nd/4.0/", "quote-only"],
    ["https://www.springer.com/tdm", "quote-only"],
    [undefined, "quote-only"],
  ])("reads %s as %s", (license, rights) => {
    expect(rightsFromLicense(license)).toBe(rights);
  });
});

describe("text extraction", () => {
  it("splits JATS abstracts at section titles", () => {
    expect(
      abstractPassages(
        "<jats:p>Lead.</jats:p><jats:sec><jats:title>Results</jats:title><jats:p>Water boils.</jats:p></jats:sec>",
      ),
    ).toEqual([
      { location: "Abstract", text: "Lead." },
      { location: "Abstract, Results", text: "Water boils." },
    ]);
  });

  it("keeps one copy of a repeated paragraph", () => {
    const paragraph = "<p>Water boils at a lower temperature at high altitude.</p>";
    expect(htmlParagraphs(`<main>${paragraph}${paragraph}</main>`)).toHaveLength(1);
  });

  it("turns table rows into passages with their headers", () => {
    const html = `<main><table><caption>Boiling point by altitude</caption>
      <tr><th>Altitude (m)</th><th>Boiling point (°C)</th></tr>
      <tr><td>0</td><td>100</td></tr><tr><td>8,848</td><td>71</td></tr></table></main>`;
    expect(htmlTablePassages(html)).toEqual([
      {
        location: "Table 1 (Boiling point by altitude), row 1",
        text: "Table 1 (Boiling point by altitude): Altitude (m): 0; Boiling point (°C): 100",
      },
      {
        location: "Table 1 (Boiling point by altitude), row 2",
        text: "Table 1 (Boiling point by altitude): Altitude (m): 8,848; Boiling point (°C): 71",
      },
    ]);
  });

  it("keeps one copy of a table the page prints twice", () => {
    const table = "<table><tr><th>T</th><th>D</th></tr><tr><td>4</td><td>1.000</td></tr></table>";
    expect(htmlTablePassages(`<main>${table}${table}</main>`)).toHaveLength(1);
  });

  it("skips JATS figures and keeps paragraphs under their nearest title", () => {
    const passages = jatsPassages(fixture("europe-pmc-fulltext.xml"));
    expect(passages.filter((passage) => passage.location.startsWith("Introduction"))).toHaveLength(
      3,
    );
  });

  it("falls back to the whole body when a page has no main element", () => {
    const html = "<body><p>Water boils at a lower temperature at high altitude.</p></body>";
    expect(htmlParagraphs(html)).toEqual(["Water boils at a lower temperature at high altitude."]);
  });
});

describe("getText", () => {
  it("backs off and retries when throttled", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () =>
      ++calls < 3 ? new Response("slow down", { status: 429 }) : new Response("ok"),
    );
    const sleep = vi.fn(() => Promise.resolve());
    const response = await getText("https://api.example/x", {
      fetchImpl,
      sleep,
      retryDelayMs: 10,
    });
    expect(response.text).toBe("ok");
    expect(sleep.mock.calls).toEqual([[10], [20]]);
  });

  it("refuses oversized bodies", async () => {
    const fetchImpl = vi.fn(async () => new Response("x".repeat(50)));
    await expect(
      getText("https://api.example/x", { fetchImpl, maxBytes: 10 }),
    ).rejects.toBeInstanceOf(SourceFetchError);
  });
});

describe("User-Agent", () => {
  it("names a contact by default and lets EVIDENCE_CONTACT override it", () => {
    expect(USER_AGENT).toBe("SBI-evidence/0.1 (alex@moonsatech.com)");
    expect(userAgentWith("https://example.org/contact")).toBe(
      "SBI-evidence/0.1 (https://example.org/contact)",
    );
    expect(userAgentWith("")).toBe(USER_AGENT);
  });

  it("sends it on every request", async () => {
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) => new Response("ok"),
    );
    await getText("https://api.example/x", { fetchImpl });
    const headers = fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(USER_AGENT);
  });
});
