import { Claim, EvidenceSource, newId } from "@sbi/contracts";
import { type FetchedSource, type Retriever, toEvidenceSource } from "@sbi/evidence";
import { z } from "zod";

export const EvidenceFixture = z.object({
  topics: z.array(
    z.object({
      topic: z.string().min(1),
      claims: z.array(
        z.object({
          claimId: z.string().min(1),
          text: z.string().min(1),
          // The Wikipedia article whose references are followed; its own text is never evidence.
          source: z.string().min(1),
          // Every term must appear in the source for the claim to count as supported.
          terms: z.array(z.string().min(1)).min(1),
        }),
      ),
    }),
  ),
});

export type EvidenceFixture = z.infer<typeof EvidenceFixture>;

/** Trusted sources for one Wikipedia article: its references, fetched; never its own text. */
export type SourceFinder = (article: string) => Promise<FetchedSource[]>;

export function trustedSourceFinder(retriever: Retriever): SourceFinder {
  const cache = new Map<string, Promise<FetchedSource[]>>();
  return (article) => {
    if (!cache.has(article)) {
      cache.set(
        article,
        retriever.discover(article).then((found) => found.fetched),
      );
    }
    return cache.get(article) as Promise<FetchedSource[]>;
  };
}

const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/[\u2009\u00a0,]/g, "")
    .replace(/\s+/g, " ");

/** Returns the sentence holding the first term, or null when any term is missing. */
export function supportingExcerpt(text: string, terms: string[]): string | null {
  const flat = normalise(text);
  if (!terms.every((term) => flat.includes(normalise(term)))) return null;
  const sentences = text.split(/(?<=[.!?])\s+/);
  const first = normalise(terms[0] ?? "");
  return sentences.find((sentence) => normalise(sentence).includes(first))?.slice(0, 1000) ?? null;
}

export interface EvidenceClaimResult {
  topic: string;
  claimId: string;
  article: string;
  sourcesFound: number;
  supported: boolean;
  contractValid: boolean;
  excerpt: string | null;
  sourceTitle: string | null;
  connector: string | null;
}

/** Checks each claim against trusted sources reached from its article, then builds contract records. */
export async function runEvidenceSpike(
  fixture: EvidenceFixture,
  findSources: SourceFinder,
): Promise<EvidenceClaimResult[]> {
  const results: EvidenceClaimResult[] = [];
  for (const topic of fixture.topics) {
    for (const claim of topic.claims) {
      const sources = await findSources(claim.source);
      let match: { source: FetchedSource; location: string; excerpt: string } | undefined;
      for (const source of sources) {
        for (const passage of source.passages) {
          const excerpt = supportingExcerpt(passage.text, claim.terms);
          if (excerpt) {
            match = { source, location: passage.location, excerpt };
            break;
          }
        }
        if (match) break;
      }
      const recordId = newId();
      const source = match
        ? EvidenceSource.safeParse(
            toEvidenceSource(match.source, {
              passages: [{ location: match.location, text: match.excerpt }],
              claimIds: [recordId],
            }),
          )
        : undefined;
      const record = Claim.safeParse({
        claimId: recordId,
        text: claim.text,
        status: source?.success ? "supported" : "unsupported",
        sourceIds: source?.success ? [source.data.sourceId] : [],
        scope: topic.topic,
        confidence: source?.success ? "medium" : "low",
        ...(source?.success ? {} : { uncertainty: "No trusted source found that states this." }),
      });
      results.push({
        topic: topic.topic,
        claimId: claim.claimId,
        article: claim.source,
        sourcesFound: sources.length,
        supported: match !== undefined,
        contractValid: (source?.success ?? true) && record.success,
        excerpt: match?.excerpt ?? null,
        sourceTitle: match?.source.title ?? null,
        connector: match?.source.retrieval.connector ?? null,
      });
    }
  }
  return results;
}
