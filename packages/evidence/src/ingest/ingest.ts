import { z } from "zod";
import { buildClaims, type RemovedClaim } from "../claims/builder";
import type { SupportJudge } from "../claims/judge";
import { type EvidenceRepositories, saveClaimGraph } from "../claims/persist";
import { sourceLocatorKey } from "../repositories";
import type { RetrievalFailure, Retriever } from "../retrieval/retriever";
import type { FetchedSource } from "../retrieval/types";

const Ref = z
  .object({ doi: z.string().min(1), pmid: z.string().min(1), url: z.url() })
  .partial()
  .refine((ref) => ref.doi || ref.pmid || ref.url, "A ref needs a doi, pmid or url");

const Draft = z.object({
  key: z.string().min(1),
  text: z.string().min(1),
  scope: z.string().min(1),
  dependsOn: z.array(z.string().min(1)).optional(),
  openQuestion: z.string().min(1).optional(),
  basic: z.boolean().optional(),
});

/** One topic to source: where to look, and the claims we want to make about it. */
export const TopicSpec = z.object({
  topic: z.string().min(1),
  /** Wikipedia articles whose references are followed; their text is never used. */
  wikipedia: z.array(z.string().min(1)).default([]),
  refs: z.array(Ref).default([]),
  drafts: z.array(Draft).min(1),
});

export type TopicSpec = z.infer<typeof TopicSpec>;

export interface IngestReport {
  topic: string;
  /** Everything fetched, so a topic with no support shows whether retrieval or the judge failed. */
  fetched: { title: string; connector: string; passages: number }[];
  sources: { title: string; connector: string; url?: string }[];
  failed: RetrievalFailure[];
  claims: { key: string; claimId: string; status: string }[];
  removed: RemovedClaim[];
}

export interface IngestOptions {
  retriever: Retriever;
  judge: SupportJudge;
  repositories: EvidenceRepositories;
  /** Serialises saves, so two runs never merge excerpts into one source at once. */
  lock?: <T>(task: () => Promise<T>) => Promise<T>;
  now?: () => Date;
  signal?: AbortSignal;
}

const locatorOf = (source: FetchedSource) => {
  try {
    return sourceLocatorKey(source);
  } catch {
    return source.title;
  }
};

/** Discovers and fetches trusted sources for a topic, builds its claims and stores the result. */
export async function ingestTopic(input: z.input<typeof TopicSpec>, options: IngestOptions) {
  const spec = TopicSpec.parse(input);
  const { retriever, signal } = options;
  const fetched = new Map<string, FetchedSource>();
  const failed: RetrievalFailure[] = [];

  for (const title of spec.wikipedia) {
    try {
      const found = await retriever.discover(title, { signal });
      for (const source of found.fetched) fetched.set(locatorOf(source), source);
      failed.push(...found.failed);
    } catch (error) {
      if (signal?.aborted) throw error;
      failed.push({ ref: { url: `wikipedia:${title}` }, reason: String(error) });
    }
  }
  for (const ref of spec.refs) {
    try {
      const source = await retriever.retrieve(ref, { signal });
      fetched.set(locatorOf(source), source);
    } catch (error) {
      if (signal?.aborted) throw error;
      failed.push({ ref, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  const sources = [...fetched.values()];
  const built = await buildClaims(spec.drafts, sources, {
    judge: options.judge,
    now: options.now,
    signal,
  });
  const lock = options.lock ?? ((task) => task());
  const saved = await lock(() => saveClaimGraph(options.repositories, built));

  const report: IngestReport = {
    topic: spec.topic,
    fetched: sources.map((source) => ({
      title: source.title,
      connector: source.retrieval.connector,
      passages: source.passages.length,
    })),
    sources: saved.sources.map((source) => ({
      title: source.title,
      connector: source.retrieval?.connector ?? "unknown",
      url: source.url,
    })),
    failed,
    claims: Object.entries(built.ids).map(([key, claimId]) => ({
      key,
      claimId,
      status: saved.claims.find((claim) => claim.claimId === claimId)?.status ?? "unknown",
    })),
    removed: built.removed,
  };
  return report;
}
