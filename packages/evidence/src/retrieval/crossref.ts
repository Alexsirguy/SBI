import type { SourceType } from "@sbi/contracts";
import { getJson, type HttpOptions } from "./http";
import { rightsFromLicense } from "./rights";
import { abstractPassages, contentSha256, stripTags } from "./text";
import type { SourceConnector } from "./types";

export interface ConnectorOptions extends HttpOptions {
  now?: () => Date;
}

interface CrossrefWork {
  message: {
    DOI: string;
    URL?: string;
    title?: string[];
    publisher?: string;
    type?: string;
    abstract?: string;
    license?: { URL: string; "content-version"?: string }[];
    issued?: { "date-parts"?: number[][] };
    author?: { given?: string; family?: string; name?: string }[];
  };
}

const TYPES: Record<string, SourceType> = {
  "journal-article": "peer-reviewed",
  "proceedings-article": "peer-reviewed",
  book: "textbook",
  "book-chapter": "textbook",
  "reference-entry": "reference",
  standard: "standard",
};

/** Only a full year-month-day is a date; a bare year would claim precision we do not have. */
export function fullDate(parts: number[] | undefined): string | undefined {
  if (!parts || parts.length < 3) return undefined;
  const [year, month, day] = parts;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function createCrossrefConnector(options: ConnectorOptions = {}): SourceConnector {
  const now = options.now ?? (() => new Date());
  return {
    id: "crossref",
    canFetch: (ref) => Boolean(ref.doi),
    async fetch(ref, { signal } = {}) {
      const url = `https://api.crossref.org/works/${encodeURIComponent(ref.doi ?? "")}`;
      const { message: work } = await getJson<CrossrefWork>(url, options, signal);
      const license = (
        work.license?.find((entry) => entry["content-version"] === "vor") ?? work.license?.[0]
      )?.URL;
      const passages = work.abstract ? abstractPassages(work.abstract) : [];
      return {
        title: stripTags(work.title?.[0] ?? work.DOI),
        publisher: work.publisher,
        authors: (work.author ?? [])
          .map((author) => author.name ?? [author.given, author.family].filter(Boolean).join(" "))
          .filter(Boolean),
        url: work.URL ?? `https://doi.org/${work.DOI}`,
        doi: work.DOI,
        sourceType: TYPES[work.type ?? ""] ?? "other",
        publishedOn: fullDate(work.issued?.["date-parts"]?.[0]),
        passages,
        // Metadata alone supports nothing, so it may only be linked to.
        rightsStatus: passages.length > 0 ? rightsFromLicense(license) : "link-only",
        retrieval: {
          connector: "crossref",
          fetchedAt: now().toISOString(),
          access: passages.length > 0 ? "abstract" : "metadata-only",
          license,
          contentSha256: contentSha256(passages),
        },
      };
    },
  };
}
