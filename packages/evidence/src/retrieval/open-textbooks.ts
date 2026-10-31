import { readableText, type RightsStatus } from "@sbi/contracts";
import type { ConnectorOptions } from "./crossref";
import { SourceFetchError } from "./http";
import { createPoliteFetcher, type PoliteFetcher } from "./robots";
import { contentSha256, htmlParagraphs, htmlTablePassages, htmlTitle, stripTags } from "./text";
import type { FetchedSource, Passage, SourceConnector, SourceRef } from "./types";

/** A licence read from the page itself; only these allow commercial reuse with credit. */
interface PageLicence {
  license: string;
  rightsStatus: RightsStatus;
}

const OPEN: Record<string, (version: string) => string> = {
  ccby: (version) => `https://creativecommons.org/licenses/by/${version}/`,
  ccbysa: (version) => `https://creativecommons.org/licenses/by-sa/${version}/`,
  publicdomain: () => "public domain",
};

// OpenStax relicensed new and updated editions as NC with an AI clause from this date.
export const OPENSTAX_RELICENSED_AT = "2026-04-22T00:00:00Z";

/** Reads a LibreTexts page's own licence tag; books mix open and non-commercial pages. */
export function libreTextsLicence(html: string): PageLicence {
  // The tag appears HTML-escaped in a tag list and URL-encoded in a search link.
  const tag = /[^a-z]license(?::|%3A)([a-z0-9]+)/.exec(html)?.[1] ?? "";
  const digits = /licenseversion(?::|%3A)(\d+)/.exec(html)?.[1] ?? "40";
  const version = `${digits.slice(0, 1)}.${digits.slice(1) || "0"}`;
  const toLicense = OPEN[tag];
  if (!toLicense) return { license: `libretexts:${tag || "unknown"}`, rightsStatus: "restricted" };
  const modified = /article:modified_time"\s+content="([^"]+)"/.exec(html)?.[1];
  // A copy refreshed from a relicensed OpenStax edition could carry NC text under an old tag.
  if (/OpenStax/.test(html) && modified && modified > OPENSTAX_RELICENSED_AT) {
    return { license: "openstax-after-relicence", rightsStatus: "restricted" };
  }
  return { license: toLicense(version), rightsStatus: "reusable" };
}

/** Wikisource hosts many licences; only works marked public domain are used. */
export function wikisourceLicence(html: string): PageLicence {
  const status = /licensetpl_short">([^<]+)</.exec(html)?.[1]?.trim();
  return status === "Public domain"
    ? { license: "public domain", rightsStatus: "reusable" }
    : { license: `wikisource:${status ?? "unknown"}`, rightsStatus: "restricted" };
}

interface TextbookHost {
  id: string;
  publisher: string;
  /** The work a page belongs to, when one host carries many independent books. */
  work?: (url: URL) => string | undefined;
  matches(url: URL): boolean;
  licence(html: string): PageLicence;
  /** Opening tag of the region holding the book text, so site chrome is never quoted. */
  content: RegExp;
}

const hostIs = (url: URL, domain: string) =>
  url.hostname === domain || url.hostname.endsWith(`.${domain}`);

export const TEXTBOOK_HOSTS: readonly TextbookHost[] = [
  {
    id: "libretexts",
    publisher: "LibreTexts",
    work: libreTextsBook,
    matches: (url) => hostIs(url, "libretexts.org") && url.pathname.startsWith("/Bookshelves/"),
    licence: libreTextsLicence,
    content: /<section[^>]*class="[^"]*mt-content-container[^"]*"[^>]*>/i,
  },
  {
    id: "kuphaldt",
    publisher: "Tony R. Kuphaldt, Lessons In Electric Circuits",
    matches: (url) =>
      url.hostname === "www.ibiblio.org" && url.pathname.startsWith("/kuphaldt/electricCircuits/"),
    // Every chapter page states "under the terms and conditions of the CC BY License".
    licence: (html) =>
      /under the terms and conditions of the CC BY License/i.test(stripTags(html))
        ? {
            license: "CC BY (Tony R. Kuphaldt, Lessons In Electric Circuits)",
            rightsStatus: "reusable",
          }
        : { license: "kuphaldt:unstated", rightsStatus: "restricted" },
    content: /<body[^>]*>/i,
  },
  {
    id: "wikisource",
    publisher: "Wikisource",
    matches: (url) => url.hostname === "en.wikisource.org" && url.pathname.startsWith("/wiki/"),
    licence: wikisourceLicence,
    content: /<div[^>]*class="[^"]*mw-parser-output[^"]*"[^>]*>/i,
  },
];

/** "/Bookshelves/<shelf>/<book>/…": the book, so chapters of one book share an origin. */
export function libreTextsBook(url: URL): string | undefined {
  const segment = url.pathname.split("/").filter(Boolean)[2];
  if (!segment) return undefined;
  try {
    return decodeURIComponent(segment).replace(/_/g, " ");
  } catch {
    return segment.replace(/_/g, " ");
  }
}

// Independence is judged by publisher, so separate books on one host must not share one.
function publisherOf(host: TextbookHost, url: string): string {
  const work = host.work?.(new URL(url));
  return work ? `${work}, ${host.publisher}` : host.publisher;
}

export function textbookHostFor(url: string): TextbookHost | undefined {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:"
      ? TEXTBOOK_HOSTS.find((host) => host.matches(parsed))
      : undefined;
  } catch {
    return undefined;
  }
}

// The host's licence notice is not book text and must never be cited as evidence.
const LICENCE_FOOTER =
  /^This page titled|is shared under a .* license|^Lessons In Electric Circuits copyright/i;

function bookText(html: string, content: RegExp): string {
  const start = content.exec(html);
  return start ? `<main>${html.slice(start.index)}</main>` : html;
}

// The page footer names the authors, e.g. "authored, remixed, and/or curated by Steven Earle".
// Tags are stripped first: a linked name's URL would otherwise end the match at "www.".
function authorsOf(html: string): string[] {
  const at = html.search(/curated by/i);
  if (at < 0) return [];
  const credit = /^curated by\s*(.{1,200}?)(?:\s*\(|\s+via\s|(?<!\b[A-Z])\.(?=\s|$))/i.exec(
    stripTags(html.slice(at, at + 2000)),
  )?.[1];
  const name = credit?.trim() ?? "";
  return name.length > 0 && name.length < 120 ? [name] : [];
}

export interface TextbookConnectorOptions extends ConnectorOptions {
  /** Shared across connectors so robots.txt rules and crawl delays apply per host. */
  fetcher?: PoliteFetcher;
}

export function createOpenTextbookConnector(
  options: TextbookConnectorOptions = {},
): SourceConnector {
  const now = options.now ?? (() => new Date());
  const fetcher = options.fetcher ?? createPoliteFetcher(options);

  return {
    id: "open-textbook",
    canFetch: (ref: SourceRef) => Boolean(ref.url && textbookHostFor(ref.url)),
    async fetch(ref, { signal } = {}): Promise<FetchedSource> {
      const host = textbookHostFor(ref.url ?? "");
      if (!host) throw new SourceFetchError(`${ref.url} is not an allowlisted open textbook`);
      const response = await fetcher.get(ref.url ?? "", signal);
      if (textbookHostFor(response.url)?.id !== host.id) {
        throw new SourceFetchError(`${ref.url} redirected outside the allowlist`);
      }
      const licence = host.licence(response.text);
      const body = bookText(response.text, host.content);
      // Text under a licence we may not reuse is never kept, so it can never be cited.
      const passages: Passage[] =
        licence.rightsStatus === "reusable"
          ? [
              // Textbooks write maths as LaTeX source; claims and quotes must read as plain text.
              ...htmlParagraphs(body)
                .filter((text) => !LICENCE_FOOTER.test(text))
                .map((text, index) => ({
                  location: `paragraph ${index + 1}`,
                  text: readableText(text),
                })),
              ...htmlTablePassages(body).map((passage) => ({
                ...passage,
                text: readableText(passage.text),
              })),
            ]
          : [];
      return {
        title: htmlTitle(response.text) ?? response.url,
        publisher: publisherOf(host, response.url),
        authors: authorsOf(response.text),
        url: response.url,
        sourceType: "textbook",
        studyDesign: "not-research",
        passages,
        rightsStatus: licence.rightsStatus,
        retrieval: {
          connector: "open-textbook",
          fetchedAt: now().toISOString(),
          access: passages.length > 0 ? "full-text" : "metadata-only",
          license: licence.license,
          contentSha256: contentSha256(passages),
        },
      };
    },
  };
}
