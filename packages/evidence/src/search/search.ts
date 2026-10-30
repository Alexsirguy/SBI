import type { InquiryQuestion } from "../plan/inquiry";
import { getJson, type HttpOptions } from "../retrieval/http";
import type { SourceRef } from "../retrieval/types";
import type { LibreTextsIndex } from "./libretexts-index";

interface WikipediaSearch {
  query?: { search?: { title: string }[] };
}

/** Article titles for a query, via the MediaWiki search API; titles only, never text. */
export async function searchWikipedia(
  query: string,
  limit: number,
  options: HttpOptions = {},
  signal?: AbortSignal,
): Promise<string[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=${limit}&srsearch=${encodeURIComponent(query)}`;
  const body = await getJson<WikipediaSearch>(url, options, signal);
  return (body.query?.search ?? []).map((result) => result.title);
}

export interface SourceSearchDeps {
  searchWikipedia: (query: string, limit: number, signal?: AbortSignal) => Promise<string[]>;
  discoverReferences: (title: string, signal?: AbortSignal) => Promise<SourceRef[]>;
  libretexts?: LibreTextsIndex;
}

export interface SourceSearchOptions {
  maxRefs?: number;
  articlesPerQuestion?: number;
  refsPerArticle?: number;
  booksPerQuestion?: number;
  signal?: AbortSignal;
}

export interface SourceSearchResult {
  refs: SourceRef[];
  articles: string[];
  textbookPages: string[];
  failures: string[];
}

// LibreTexts splits its library into one site per subject.
const DISCIPLINE_SITES: Partial<Record<InquiryQuestion["discipline"], string[]>> = {
  physics: ["https://phys.libretexts.org"],
  chemistry: ["https://chem.libretexts.org"],
  biology: ["https://bio.libretexts.org"],
  maths: ["https://math.libretexts.org"],
  "earth-science": ["https://geo.libretexts.org"],
  engineering: ["https://eng.libretexts.org"],
};

const refKey = (ref: SourceRef) => ref.doi?.toLowerCase() ?? ref.pmid ?? ref.url ?? "";

/** Trusted refs for one sub-question: open-textbook pages first, then Wikipedia's references. */
export async function searchSources(
  question: InquiryQuestion,
  deps: SourceSearchDeps,
  options: SourceSearchOptions = {},
): Promise<SourceSearchResult> {
  const failures: string[] = [];
  const query = question.searchTerms.join(" ");
  const textbookPages = deps.libretexts
    ? await deps.libretexts
        .search(`${question.question} ${query}`, options.booksPerQuestion ?? 3, {
          preferSites: DISCIPLINE_SITES[question.discipline] ?? [],
        })
        .catch((error: unknown) => {
          failures.push(`libretexts: ${String(error)}`);
          return [];
        })
    : [];

  const found = await deps.searchWikipedia(query, 2, options.signal).catch((error: unknown) => {
    failures.push(`wikipedia search: ${String(error)}`);
    return [];
  });
  const articles = [...new Set([...question.wikipediaArticles, ...found])].slice(
    0,
    options.articlesPerQuestion ?? 4,
  );

  const refs = new Map<string, SourceRef>();
  for (const url of textbookPages) refs.set(url, { url });
  for (const title of articles) {
    const discovered = await deps
      .discoverReferences(title, options.signal)
      .catch((error: unknown) => {
        failures.push(`references of ${title}: ${String(error)}`);
        return [];
      });
    for (const ref of discovered.slice(0, options.refsPerArticle ?? 3)) {
      if (!refs.has(refKey(ref))) refs.set(refKey(ref), ref);
    }
  }
  return {
    refs: [...refs.values()].slice(0, options.maxRefs ?? 8),
    articles,
    textbookPages,
    failures,
  };
}
