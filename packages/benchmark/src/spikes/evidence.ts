import { Claim, EvidenceSource, newId } from "@sbi/contracts";
import { z } from "zod";

export const EvidenceFixture = z.object({
  topics: z.array(
    z.object({
      topic: z.string().min(1),
      claims: z.array(
        z.object({
          claimId: z.string().min(1),
          text: z.string().min(1),
          source: z.string().min(1),
          // Every term must appear in the source for the claim to count as supported.
          terms: z.array(z.string().min(1)).min(1),
        }),
      ),
    }),
  ),
});

export type EvidenceFixture = z.infer<typeof EvidenceFixture>;
export type ArticleFetcher = (title: string) => Promise<string>;

const USER_AGENT = "SBI-benchmark/1.0 (research prototype)";

export function wikipediaFetcher(fetchImpl: typeof fetch = fetch): ArticleFetcher {
  const cache = new Map<string, Promise<string>>();
  return (title) => {
    if (!cache.has(title)) {
      const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(title)}`;
      cache.set(
        title,
        fetchImpl(url, { headers: { "User-Agent": USER_AGENT } })
          .then(
            (response) =>
              response.json() as Promise<{
                query: { pages: Record<string, { extract?: string }> };
              }>,
          )
          .then((body) => Object.values(body.query.pages)[0]?.extract ?? ""),
      );
    }
    return cache.get(title) as Promise<string>;
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
  source: string;
  supported: boolean;
  contractValid: boolean;
  excerpt: string | null;
}

/** Builds contract records for each claim from retrieved text, then checks the citation supports it. */
export async function runEvidenceSpike(
  fixture: EvidenceFixture,
  fetchArticle: ArticleFetcher,
  now: Date = new Date(),
): Promise<EvidenceClaimResult[]> {
  const results: EvidenceClaimResult[] = [];
  for (const topic of fixture.topics) {
    for (const claim of topic.claims) {
      const text = await fetchArticle(claim.source);
      const excerpt = supportingExcerpt(text, claim.terms);
      const sourceId = newId();
      const recordId = newId();
      const source = EvidenceSource.safeParse({
        sourceId,
        title: claim.source,
        publisher: "Wikipedia",
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(claim.source.replace(/ /g, "_"))}`,
        sourceType: "encyclopedia",
        accessedOn: now.toISOString().slice(0, 10),
        excerpts: [
          {
            excerptId: `${claim.claimId}-x1`,
            location: "article text",
            text: excerpt ?? "(no supporting text found)",
          },
        ],
        claimIds: [recordId],
        evidenceQuality: "moderate",
        rightsStatus: "quote-only",
        lastCheckedAt: now.toISOString(),
      });
      const record = Claim.safeParse({
        claimId: recordId,
        text: claim.text,
        status: excerpt ? "supported" : "unsupported",
        sourceIds: excerpt ? [sourceId] : [],
        scope: topic.topic,
        confidence: excerpt ? "medium" : "low",
        ...(excerpt ? {} : { uncertainty: "No supporting passage found in the cited source." }),
      });
      results.push({
        topic: topic.topic,
        claimId: claim.claimId,
        source: claim.source,
        supported: excerpt !== null,
        contractValid: source.success && record.success,
        excerpt,
      });
    }
  }
  return results;
}
