import type { TaxonomyMatch } from "@sbi/contracts";
import { MAX_SEARCH_RESULTS, words, type Taxonomy } from "./taxonomy";

export type GapSource = "observation" | "recognition-label";

export interface CatalogGap {
  term: string;
  source: GapSource;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
}

/** Aggregated counts only: no session, photo or timestamp per learner is kept. */
export interface CatalogGapRepository {
  record(term: string, source: GapSource, at: Date): Promise<void>;
  top(limit: number): Promise<CatalogGap[]>;
}

const STOPWORDS = new Set(
  "a an and are as at be but by for from has have i in is it its like my of on or so that the this to was with".split(
    " ",
  ),
);
const MAX_TERM_WORDS = 6;
export const MAX_GAP_TERM_LENGTH = 60;

// Digits are dropped so phone numbers, addresses or ages typed by mistake never reach the catalog.
export function normaliseGapTerm(text: string): string | null {
  const kept = words(text)
    .filter((word) => word.length > 1 && !/\d/.test(word) && !STOPWORDS.has(word))
    .slice(0, MAX_TERM_WORDS)
    .join(" ")
    .slice(0, MAX_GAP_TERM_LENGTH)
    .trim();
  return kept.length >= 2 ? kept : null;
}

// Each observation is searched word by word, so "round, metal, makes tea" can still find a kettle.
export function searchObservations(
  taxonomy: Taxonomy,
  observations: readonly string[],
  limit = MAX_SEARCH_RESULTS,
): TaxonomyMatch[] {
  const scores = new Map<string, { match: TaxonomyMatch; score: number }>();
  const terms = [
    ...new Set(observations.flatMap((text) => words(text)).filter((w) => !STOPWORDS.has(w))),
  ];
  for (const term of terms) {
    taxonomy.search(term).forEach((match, rank) => {
      const entry = scores.get(match.taxonomyId) ?? { match, score: 0 };
      entry.score += MAX_SEARCH_RESULTS - rank;
      scores.set(match.taxonomyId, entry);
    });
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score || a.match.label.localeCompare(b.match.label))
    .slice(0, limit)
    .map(({ match }) => match);
}
