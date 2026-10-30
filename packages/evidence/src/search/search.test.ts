import { describe, expect, it, vi } from "vitest";
import type { InquiryQuestion } from "../plan/inquiry";
import type { PoliteFetcher } from "../retrieval/robots";
import { createLibreTextsIndex } from "./libretexts-index";
import { searchSources, searchWikipedia } from "./search";
import { searchTokens } from "./tokens";

const BOOK =
  "https://phys.libretexts.org/Bookshelves/University_Physics/Calculus-Based_Physics_(Schnick)";
const NC_BOOK = "https://phys.libretexts.org/Bookshelves/Other/Closed_Book";

const sitemap = `<urlset>
<url><loc>${BOOK}/Volume_A/36A%3A_Heat%3A_Phase_Changes</loc></url>
<url><loc>${BOOK}/Volume_A/20A%3A_Torque_and_Lever_Arms</loc></url>
<url><loc>${BOOK}/Volume_A/01A%3A_Units</loc></url>
<url><loc>${NC_BOOK}/Chapter_1/Heat_Phase_Changes_and_Latent_Heat</loc></url>
</urlset>`;

function fetcher(pages: Record<string, string>): PoliteFetcher & { get: ReturnType<typeof vi.fn> } {
  return {
    get: vi.fn(async (url: string) => {
      const text = pages[url];
      if (text === undefined) throw new Error(`no page ${url}`);
      return { url, text };
    }),
  };
}

const question = (overrides: Partial<InquiryQuestion> = {}): InquiryQuestion => ({
  key: "q1",
  discipline: "physics",
  question: "Why does water stay at its boiling point while it boils?",
  searchTerms: ["phase change", "latent heat"],
  wikipediaArticles: ["Latent heat"],
  dependsOn: [],
  ...overrides,
});

describe("searchTokens", () => {
  it("drops stop words and stems plurals and -ing forms", () => {
    expect(searchTokens("Why do the gears change heating?")).toEqual(["gear", "change", "heat"]);
  });
});

describe("createLibreTextsIndex", () => {
  it("finds pages of open books by title words and ignores other books", async () => {
    const index = createLibreTextsIndex({
      fetcher: fetcher({ "https://phys.libretexts.org/sitemap.xml": sitemap }),
      books: [BOOK],
    });
    const results = await index.search("phase changes and latent heat", 5);
    expect(results).toEqual([`${BOOK}/Volume_A/36A%3A_Heat%3A_Phase_Changes`]);
    expect(results.some((url) => url.startsWith(NC_BOOK))).toBe(false);
  });

  it("takes the best page from each book before a second page from any one book", async () => {
    const other =
      "https://phys.libretexts.org/Bookshelves/University_Physics/University_Physics_(OpenStax)";
    const pages = `<urlset>
<url><loc>${BOOK}/Volume_B/Magnifier_Lens_Images</loc></url>
<url><loc>${BOOK}/Volume_B/Magnifier_Lens_Image_Formation</loc></url>
<url><loc>${other}/Optics/Simple_Magnifier_Lens</loc></url>
</urlset>`;
    const index = createLibreTextsIndex({
      fetcher: fetcher({ "https://phys.libretexts.org/sitemap.xml": pages }),
      books: [BOOK, other],
    });
    const results = await index.search("magnifier lens image formation", 2);
    expect(results).toEqual([
      `${BOOK}/Volume_B/Magnifier_Lens_Image_Formation`,
      `${other}/Optics/Simple_Magnifier_Lens`,
    ]);
  });

  it("reads sites that publish a sitemap index, such as chemistry", async () => {
    const chem =
      "https://chem.libretexts.org/Bookshelves/General_Chemistry/Chemistry_2e_(OpenStax)";
    const index = createLibreTextsIndex({
      fetcher: fetcher({
        "https://chem.libretexts.org/sitemap.xml": `<sitemapindex><sitemap><loc>https://chem.libretexts.org/sitemap_0.xml</loc></sitemap><sitemap><loc>https://evil.example/sitemap.xml</loc></sitemap></sitemapindex>`,
        "https://chem.libretexts.org/sitemap_0.xml": `<urlset><url><loc>${chem}/10%3A_Liquids_and_Solids/10.06%3A_Lattice_Structures_in_Crystalline_Solids</loc></url></urlset>`,
      }),
      books: [chem],
    });
    expect(await index.search("crystal lattice structures", 3)).toEqual([
      `${chem}/10%3A_Liquids_and_Solids/10.06%3A_Lattice_Structures_in_Crystalline_Solids`,
    ]);
  });

  it("ranks the sub-question's own subject site first when title words tie", async () => {
    const bio =
      "https://bio.libretexts.org/Bookshelves/Introductory_and_General_Biology/Biology_(Kimball)";
    const chem = "https://chem.libretexts.org/Bookshelves/General_Chemistry/Chem1_(Lower)";
    const pages: Record<string, string> = {
      "https://bio.libretexts.org/sitemap.xml": `<urlset><url><loc>${bio}/Unit_2%3A_Cell_Structure</loc></url></urlset>`,
      "https://chem.libretexts.org/sitemap.xml": `<urlset><url><loc>${chem}/07%3A_Solids/7.02%3A_Unit_Cell_Structure_of_Ionic_Crystals</loc></url></urlset>`,
    };
    const index = createLibreTextsIndex({ fetcher: fetcher(pages), books: [bio, chem] });
    const query = "unit cell structure";
    expect((await index.search(query, 1))[0]).toContain("bio.libretexts.org");
    expect(
      (await index.search(query, 1, { preferSites: ["https://chem.libretexts.org"] }))[0],
    ).toContain("chem.libretexts.org");
  });

  it("needs a third shared title word from a page outside the sub-question's subject", async () => {
    const bio =
      "https://bio.libretexts.org/Bookshelves/Introductory_and_General_Biology/Biology_(Kimball)";
    const index = createLibreTextsIndex({
      fetcher: fetcher({
        "https://bio.libretexts.org/sitemap.xml": `<urlset><url><loc>${bio}/Studying_Cells_the_Basic_Unit</loc></url></urlset>`,
      }),
      books: [bio],
    });
    const query = "crystal unit cell repeating";
    expect(await index.search(query, 3)).toHaveLength(1);
    expect(await index.search(query, 3, { preferSites: ["https://chem.libretexts.org"] })).toEqual(
      [],
    );
    expect(
      await index.search(`${query} basic`, 3, { preferSites: ["https://chem.libretexts.org"] }),
    ).toHaveLength(1);
  });

  it("needs two shared title words before a page counts as a match", async () => {
    const index = createLibreTextsIndex({
      fetcher: fetcher({ "https://phys.libretexts.org/sitemap.xml": sitemap }),
      books: [BOOK],
    });
    expect(await index.search("units of torque", 5)).toEqual([]);
    expect(await index.search("torque lever arms", 5)).toHaveLength(1);
  });

  it("builds the index once and rebuilds it only when it is stale", async () => {
    let now = 0;
    const source = fetcher({ "https://phys.libretexts.org/sitemap.xml": sitemap });
    const index = createLibreTextsIndex({
      fetcher: source,
      books: [BOOK],
      now: () => now,
      maxAgeMs: 1000,
    });
    await index.search("torque lever", 1);
    await index.search("phase change", 1);
    expect(source.get).toHaveBeenCalledTimes(1);
    now = 2000;
    await index.search("phase change", 1);
    expect(source.get).toHaveBeenCalledTimes(2);
  });

  it("returns nothing rather than failing when a sitemap cannot be read", async () => {
    const index = createLibreTextsIndex({ fetcher: fetcher({}), books: [BOOK] });
    expect(await index.search("phase change", 3)).toEqual([]);
  });
});

describe("searchWikipedia", () => {
  it("returns article titles only", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request) =>
      Response.json({ query: { search: [{ title: "Latent heat", snippet: "<b>text</b>" }] } }),
    );
    expect(await searchWikipedia("latent heat", 2, { fetchImpl })).toEqual(["Latent heat"]);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("srlimit=2");
  });
});

describe("searchSources", () => {
  const index = { search: vi.fn(async () => [`${BOOK}/Volume_A/36A%3A_Heat%3A_Phase_Changes`]) };

  it("puts open-textbook pages first, then trusted references from concept articles", async () => {
    const discoverReferences = vi.fn(async (title: string) =>
      title === "Latent heat"
        ? [{ doi: "10.1063/1.1475333" }, { url: "https://www.nist.gov/water" }]
        : [{ doi: "10.1063/1.1475333" }],
    );
    const result = await searchSources(question(), {
      libretexts: index,
      searchWikipedia: async () => ["Enthalpy of vaporization"],
      discoverReferences,
    });
    expect(result.articles).toEqual(["Latent heat", "Enthalpy of vaporization"]);
    expect(result.refs).toEqual([
      { url: `${BOOK}/Volume_A/36A%3A_Heat%3A_Phase_Changes` },
      { doi: "10.1063/1.1475333" },
      { url: "https://www.nist.gov/water" },
    ]);
  });

  it("caps what it returns and records failures instead of throwing", async () => {
    const result = await searchSources(
      question(),
      {
        libretexts: index,
        searchWikipedia: async () => {
          throw new Error("429");
        },
        discoverReferences: async () => Array.from({ length: 10 }, (_, n) => ({ pmid: String(n) })),
      },
      { maxRefs: 3 },
    );
    expect(result.refs).toHaveLength(3);
    expect(result.failures.join(" ")).toContain("wikipedia search");
  });
});
