import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildClaims } from "../claims/builder";
import { licenseInfo } from "../citations/display";
import {
  createOpenTextbookConnector,
  libreTextsBook,
  libreTextsLicence,
  textbookHostFor,
  wikisourceLicence,
} from "./open-textbooks";
import { refFromLink } from "./wikipedia";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
const EARLE =
  "https://geo.libretexts.org/Bookshelves/Geology/Physical_Geology_(Earle)/01%3A_Introduction_to_Geology/1.02%3A_Why_Study_Earth";
const PETRUCCI =
  "https://chem.libretexts.org/Bookshelves/General_Chemistry/Map%3A_General_Chemistry_(Petrucci_et_al.)/01%3A_Matter-_Its_Properties_And_Measurement/1.1%3A_The_Scientific_Method";
const KUPHALDT = "https://www.ibiblio.org/kuphaldt/electricCircuits/DC/DC_1.html";
const WIKISOURCE = "https://en.wikisource.org/wiki/A_History_of_Science";

function serving(pages: Record<string, string>) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    const response = new Response(pages[url] ?? "missing", { status: pages[url] ? 200 : 404 });
    Object.defineProperty(response, "url", { value: url });
    return response;
  });
}

const connector = (
  pages: Record<string, string>,
  sleep = vi.fn(async (_ms: number) => undefined),
) =>
  createOpenTextbookConnector({
    fetchImpl: serving(pages),
    sleep,
    now: () => new Date("2026-10-29T09:00:00Z"),
  });

describe("textbookHostFor", () => {
  it("allowlists book pages on the vetted hosts only", () => {
    expect(textbookHostFor(EARLE)?.id).toBe("libretexts");
    expect(textbookHostFor(KUPHALDT)?.id).toBe("kuphaldt");
    expect(textbookHostFor(WIKISOURCE)?.id).toBe("wikisource");
    expect(textbookHostFor("https://geo.libretexts.org/@api/deki/pages")).toBeUndefined();
    expect(textbookHostFor("https://www.ibiblio.org/other/book.html")).toBeUndefined();
    expect(textbookHostFor("http://geo.libretexts.org/Bookshelves/x")).toBeUndefined();
    expect(
      textbookHostFor("https://openstax.org/books/physics/pages/1-introduction"),
    ).toBeUndefined();
  });

  it("lets Wikipedia discovery follow references to these books", () => {
    expect(refFromLink(EARLE)).toEqual({ url: EARLE });
  });
});

describe("LibreTexts licences", () => {
  it("reads the page's own tag and version", () => {
    expect(libreTextsLicence(fixture("libretexts-open.html"))).toEqual({
      license: "https://creativecommons.org/licenses/by/4.0/",
      rightsStatus: "reusable",
    });
    expect(libreTextsLicence("tags=license%3Accbysa ... licenseversion%3A30")).toEqual({
      license: "https://creativecommons.org/licenses/by-sa/3.0/",
      rightsStatus: "reusable",
    });
  });

  it("refuses non-commercial pages and pages with no tag", () => {
    expect(libreTextsLicence(fixture("libretexts-nc.html")).rightsStatus).toBe("restricted");
    expect(libreTextsLicence("<html></html>").rightsStatus).toBe("restricted");
  });

  it("refuses OpenStax copies changed after the April 2026 relicence", () => {
    const page = (modified: string) =>
      `tags=license%3Accby <meta property="article:modified_time" content="${modified}"> OpenStax`;
    expect(libreTextsLicence(page("2026-09-22T19:11:12Z")).rightsStatus).toBe("restricted");
    expect(libreTextsLicence(page("2024-01-10T00:00:00Z")).rightsStatus).toBe("reusable");
  });
});

describe("libreTextsBook", () => {
  it("names the book a page belongs to, the same for every chapter of it", () => {
    const book = (path: string) =>
      libreTextsBook(new URL(`https://phys.libretexts.org/Bookshelves/University_Physics/${path}`));
    expect(book("Calculus-Based_Physics_(Schnick)/Volume_B%3A_Optics/B27")).toBe(
      "Calculus-Based Physics (Schnick)",
    );
    expect(book("University_Physics_(OpenStax)/Vol_3/02/2.08")).toBe(
      book("University_Physics_(OpenStax)/Vol_3/02"),
    );
    expect(libreTextsBook(new URL("https://phys.libretexts.org/Bookshelves"))).toBeUndefined();
  });
});

describe("Wikisource licences", () => {
  it("uses only works marked public domain", () => {
    expect(wikisourceLicence(fixture("wikisource-pd.html")).rightsStatus).toBe("reusable");
    expect(wikisourceLicence('<span class="licensetpl_short">CC BY-NC</span>').rightsStatus).toBe(
      "restricted",
    );
  });
});

describe("createOpenTextbookConnector", () => {
  it("keeps book paragraphs with the page licence, never navigation or the licence footer", async () => {
    const source = await connector({ [EARLE]: fixture("libretexts-open.html") }).fetch({
      url: EARLE,
    });

    expect(source).toMatchObject({
      publisher: "Physical Geology (Earle), LibreTexts",
      authors: ["Steven Earle"],
      sourceType: "textbook",
      rightsStatus: "reusable",
      retrieval: {
        connector: "open-textbook",
        access: "full-text",
        license: "https://creativecommons.org/licenses/by/4.0/",
      },
    });
    const text = source.passages.map((passage) => passage.text).join("\n");
    expect(source.passages.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/navigation|This page titled|shared under a/);
    expect(licenseInfo(source.retrieval.license)?.label).toBe("CC BY 4.0");
  });

  it("reads a linked author credit as a plain name", async () => {
    const linked = fixture("libretexts-open.html").replace(
      "curated by Steven Earle (BCCampus).",
      'curated by <a rel="nofollow" href="https://openstax.org/">OpenStax</a> via <a href="https://openstax.org/details">source content</a> that was edited.',
    );
    const source = await connector({ [EARLE]: linked }).fetch({ url: EARLE });
    expect(source.authors).toEqual(["OpenStax"]);
  });

  it("keeps no text from a page whose licence forbids commercial reuse", async () => {
    const source = await connector({ [PETRUCCI]: fixture("libretexts-nc.html") }).fetch({
      url: PETRUCCI,
    });
    expect(source).toMatchObject({
      passages: [],
      rightsStatus: "restricted",
      retrieval: { access: "metadata-only", license: "libretexts:ccbyncsa" },
    });
  });

  it("reads Kuphaldt's CC BY chapters and public-domain Wikisource works", async () => {
    const pages = {
      [KUPHALDT]: fixture("kuphaldt.html"),
      [WIKISOURCE]: fixture("wikisource-pd.html"),
    };
    const circuits = await connector(pages).fetch({ url: KUPHALDT });
    expect(circuits.rightsStatus).toBe("reusable");
    expect(circuits.passages.map((passage) => passage.text).join(" ")).not.toContain(
      "copyright (C)",
    );
    const history = await connector(pages).fetch({ url: WIKISOURCE });
    expect(history).toMatchObject({
      rightsStatus: "reusable",
      retrieval: { license: "public domain" },
    });
    expect(licenseInfo(history.retrieval.license)?.label).toBe("Public domain");
  });

  it("waits out the crawl delay the host's robots.txt asks for", async () => {
    const sleep = vi.fn(async (_ms: number) => undefined);
    const target = connector(
      {
        [EARLE]: fixture("libretexts-open.html"),
        "https://geo.libretexts.org/robots.txt": "User-agent: *\nCrawl-delay: 5\nDisallow: /@*\n",
      },
      sleep,
    );
    await target.fetch({ url: EARLE });
    await target.fetch({ url: EARLE });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls[0]?.[0]).toBeGreaterThan(4000);
  });
});

describe("textbook independence", () => {
  const shelf = "https://geo.libretexts.org/Bookshelves/Geology";
  const chapter = (book: string, page: string) => `${shelf}/${book}/01%3A_Intro/${page}`;

  async function claimFrom(urls: string[]) {
    const read = connector(
      Object.fromEntries(urls.map((url) => [url, fixture("libretexts-open.html")])),
    );
    const sources = await Promise.all(urls.map((url) => read.fetch({ url })));
    const text = sources[0]?.passages[0]?.text ?? "";
    const built = await buildClaims([{ key: "k", text, scope: "geology" }], sources, {
      judge: { version: "t", judge: async () => ({ verdict: "supports", reason: "ok" }) },
    });
    return built.claims[0];
  }

  it("lets two different books corroborate a claim, but not two chapters of one book", async () => {
    const twoBooks = await claimFrom([
      chapter("Physical_Geology_(Earle)", "1.02"),
      chapter("Geology_(Lumen)", "1.03"),
    ]);
    const oneBook = await claimFrom([
      chapter("Physical_Geology_(Earle)", "1.02"),
      chapter("Physical_Geology_(Earle)", "1.04"),
    ]);
    expect(twoBooks).toMatchObject({ status: "supported", confidence: "high" });
    expect(oneBook?.status).toBe("qualified");
    expect(oneBook?.uncertainty).toContain("Only one independent source");
  });
});
