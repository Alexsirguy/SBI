import type { RightsStatus } from "@sbi/contracts";
import type { ConnectorOptions } from "./crossref";
import { getText, SourceFetchError } from "./http";
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
  matches(url: URL): boolean;
  licence(html: string): PageLicence;
  /** Opening tag of the region holding the book text, so site chrome is never quoted. */
  content: RegExp;
  /** Seconds between requests that the host's robots.txt asks for. */
  crawlDelaySeconds: number;
}

const hostIs = (url: URL, domain: string) =>
  url.hostname === domain || url.hostname.endsWith(`.${domain}`);

export const TEXTBOOK_HOSTS: readonly TextbookHost[] = [
  {
    id: "libretexts",
    publisher: "LibreTexts",
    matches: (url) => hostIs(url, "libretexts.org") && url.pathname.startsWith("/Bookshelves/"),
    licence: libreTextsLicence,
    content: /<section[^>]*class="[^"]*mt-content-container[^"]*"[^>]*>/i,
    crawlDelaySeconds: 5,
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
    crawlDelaySeconds: 2,
  },
  {
    id: "wikisource",
    publisher: "Wikisource",
    matches: (url) => url.hostname === "en.wikisource.org" && url.pathname.startsWith("/wiki/"),
    licence: wikisourceLicence,
    content: /<div[^>]*class="[^"]*mw-parser-output[^"]*"[^>]*>/i,
    crawlDelaySeconds: 1,
  },
];

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
function authorsOf(html: string): string[] {
  const credit = /curated by\s*([\s\S]{1,200}?)(?:\(|via|\.)/.exec(html)?.[1];
  return credit ? [stripTags(credit)].filter((name) => name.length > 0 && name.length < 120) : [];
}

export interface TextbookConnectorOptions extends ConnectorOptions {
  /** Injected in tests; real runs wait out each host's crawl delay. */
  wait?: (ms: number) => Promise<void>;
}

export function createOpenTextbookConnector(
  options: TextbookConnectorOptions = {},
): SourceConnector {
  const now = options.now ?? (() => new Date());
  const wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const lastRequest = new Map<string, number>();

  async function politely(host: TextbookHost) {
    const due = (lastRequest.get(host.id) ?? 0) + host.crawlDelaySeconds * 1000;
    const delay = due - Date.now();
    if (delay > 0) await wait(delay);
    lastRequest.set(host.id, Date.now());
  }

  return {
    id: "open-textbook",
    canFetch: (ref: SourceRef) => Boolean(ref.url && textbookHostFor(ref.url)),
    async fetch(ref, { signal } = {}): Promise<FetchedSource> {
      const host = textbookHostFor(ref.url ?? "");
      if (!host) throw new SourceFetchError(`${ref.url} is not an allowlisted open textbook`);
      await politely(host);
      const response = await getText(ref.url ?? "", options, signal);
      if (textbookHostFor(response.url)?.id !== host.id) {
        throw new SourceFetchError(`${ref.url} redirected outside the allowlist`);
      }
      const licence = host.licence(response.text);
      const body = bookText(response.text, host.content);
      // Text under a licence we may not reuse is never kept, so it can never be cited.
      const passages: Passage[] =
        licence.rightsStatus === "reusable"
          ? [
              ...htmlParagraphs(body)
                .filter((text) => !LICENCE_FOOTER.test(text))
                .map((text, index) => ({ location: `paragraph ${index + 1}`, text })),
              ...htmlTablePassages(body),
            ]
          : [];
      return {
        title: htmlTitle(response.text) ?? response.url,
        publisher: host.publisher,
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
