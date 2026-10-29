import { EvidenceSource, newId, type SourceType } from "@sbi/contracts";
import { createCrossrefConnector, type ConnectorOptions } from "./crossref";
import { createEuropePmcConnector } from "./europe-pmc";
import { createUsGovConnector } from "./us-gov";
import { discoverReferences } from "./wikipedia";
import type { FetchedSource, FetchOptions, Passage, SourceConnector, SourceRef } from "./types";

export class UntrustedSourceError extends Error {
  constructor(ref: SourceRef) {
    super(`No trusted connector fetches ${JSON.stringify(ref)}`);
    this.name = "UntrustedSourceError";
  }
}

export interface RetrievalFailure {
  ref: SourceRef;
  reason: string;
}

export interface RetrieveOptions extends FetchOptions {
  /** Tries this connector first, so a re-check reads the same record it stored. */
  prefer?: string;
}

export interface Retriever {
  retrieve(ref: SourceRef, options?: RetrieveOptions): Promise<FetchedSource>;
  /** Follows a Wikipedia article's references to trusted sources and fetches them. */
  discover(
    title: string,
    options?: FetchOptions,
  ): Promise<{ fetched: FetchedSource[]; failed: RetrievalFailure[] }>;
}

export interface RetrieverOptions {
  connectors: SourceConnector[];
  discoverRefs: (title: string, signal?: AbortSignal) => Promise<SourceRef[]>;
  maxSources?: number;
}

const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function createRetriever(options: RetrieverOptions): Retriever {
  async function retrieve(ref: SourceRef, { signal, prefer }: RetrieveOptions = {}) {
    const able = options.connectors
      .filter((connector) => connector.canFetch(ref))
      .sort((a, b) => Number(b.id === prefer) - Number(a.id === prefer));
    if (able.length === 0) throw new UntrustedSourceError(ref);
    const errors: string[] = [];
    // Connectors are in preference order; a later one may still have the source.
    for (const connector of able) {
      try {
        return await connector.fetch(ref, { signal });
      } catch (error) {
        if (signal?.aborted) throw error;
        errors.push(`${connector.id}: ${reason(error)}`);
      }
    }
    throw new Error(errors.join("; "));
  }

  return {
    retrieve,
    async discover(title, { signal } = {}) {
      const refs = (await options.discoverRefs(title, signal)).slice(0, options.maxSources ?? 8);
      const fetched: FetchedSource[] = [];
      const failed: RetrievalFailure[] = [];
      // One at a time: these are free public APIs and bursts get throttled.
      for (const ref of refs) {
        try {
          fetched.push(await retrieve(ref, { signal }));
        } catch (error) {
          if (signal?.aborted) throw error;
          failed.push({ ref, reason: reason(error) });
        }
      }
      return { fetched, failed };
    },
  };
}

/** Europe PMC first: it carries abstracts and licences that Crossref often lacks. */
export function createDefaultRetriever(options: ConnectorOptions = {}): Retriever {
  return createRetriever({
    connectors: [
      createEuropePmcConnector(options),
      createCrossrefConnector(options),
      createUsGovConnector(options),
    ],
    discoverRefs: (title, signal) => discoverReferences(title, options, signal),
  });
}

const QUALITY: Record<SourceType, EvidenceSource["evidenceQuality"]> = {
  standard: "high",
  institution: "high",
  textbook: "high",
  "peer-reviewed": "moderate",
  reference: "moderate",
  encyclopedia: "moderate",
  media: "low",
  other: "low",
};

export interface ExcerptChoice {
  sourceId?: string;
  passages: Passage[];
  claimIds?: string[];
}

/** Stores only the passages that support claims, with the fetch record kept alongside. */
export function toEvidenceSource(fetched: FetchedSource, choice: ExcerptChoice): EvidenceSource {
  const fetchedAt = fetched.retrieval.fetchedAt;
  return EvidenceSource.parse({
    sourceId: choice.sourceId ?? newId(),
    title: fetched.title,
    publisher: fetched.publisher,
    authors: fetched.authors,
    url: fetched.url,
    doi: fetched.doi,
    sourceType: fetched.sourceType,
    studyDesign: fetched.studyDesign,
    publishedOn: fetched.publishedOn,
    accessedOn: fetchedAt.slice(0, 10),
    excerpts: choice.passages.map((passage, index) => ({
      excerptId: `x${index + 1}`,
      location: passage.location,
      text: passage.text.slice(0, 1000),
    })),
    claimIds: choice.claimIds ?? [],
    evidenceQuality: QUALITY[fetched.sourceType],
    rightsStatus: fetched.rightsStatus,
    lastCheckedAt: fetchedAt,
    retrieval: fetched.retrieval,
  });
}
