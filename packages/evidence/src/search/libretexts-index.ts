import type { PoliteFetcher } from "../retrieval/robots";
import { OPEN_LIBRETEXTS_BOOKS } from "./libretexts-books";
import { searchTokens } from "./tokens";

interface IndexedPage {
  url: string;
  bookTokens: Set<string>;
  titleTokens: Set<string>;
}

export interface LibreTextsIndex {
  search(query: string, limit: number): Promise<string[]>;
}

export interface LibreTextsIndexOptions {
  /** Needs a large body cap: each site's sitemap is several megabytes. */
  fetcher: PoliteFetcher;
  books?: readonly string[];
  maxAgeMs?: number;
  now?: () => number;
}

const WEEK_MS = 7 * 86_400_000;

const decode = (segment: string) => {
  try {
    return decodeURIComponent(segment).replace(/_/g, " ");
  } catch {
    return segment.replace(/_/g, " ");
  }
};

function indexPages(sitemap: string, books: readonly string[]): IndexedPage[] {
  const pages: IndexedPage[] = [];
  for (const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const url = match[1] ?? "";
    const book = books.find((prefix) => url === prefix || url.startsWith(`${prefix}/`));
    if (!book) continue;
    const segments = url.slice(book.length).split("/").filter(Boolean);
    pages.push({
      url,
      bookTokens: new Set(searchTokens(decode(book.split("/").at(-1) ?? ""))),
      titleTokens: new Set(searchTokens(segments.map(decode).join(" "))),
    });
  }
  return pages;
}

/** Keyword search over the open books' page titles, built from the sites' sitemaps. */
export function createLibreTextsIndex(options: LibreTextsIndexOptions): LibreTextsIndex {
  const books = options.books ?? OPEN_LIBRETEXTS_BOOKS;
  const now = options.now ?? Date.now;
  let built: { at: number; pages: Promise<IndexedPage[]> } | undefined;

  function pages(): Promise<IndexedPage[]> {
    if (built && now() - built.at < (options.maxAgeMs ?? WEEK_MS)) return built.pages;
    const sites = [...new Set(books.map((book) => new URL(book).origin))];
    const loading = Promise.all(
      sites.map(async (site) => {
        try {
          const response = await options.fetcher.get(`${site}/sitemap.xml`);
          return indexPages(response.text, books);
        } catch {
          // One unreachable site must not empty the whole index.
          return [];
        }
      }),
    ).then((lists) => lists.flat());
    built = { at: now(), pages: loading };
    return loading;
  }

  return {
    async search(query, limit) {
      const wanted = [...new Set(searchTokens(query))];
      if (wanted.length === 0) return [];
      const scored = (await pages())
        .map((page) => {
          const inTitle = wanted.filter((token) => page.titleTokens.has(token)).length;
          const inBook = wanted.filter((token) => page.bookTokens.has(token)).length;
          return { url: page.url, inTitle, score: inTitle * 2 + inBook * 0.5 };
        })
        // A page whose own title shares at least two query words is worth fetching.
        .filter((item) => item.inTitle >= Math.min(2, wanted.length))
        .sort((a, b) => b.score - a.score || a.url.length - b.url.length);
      return scored.slice(0, limit).map((item) => item.url);
    },
  };
}
