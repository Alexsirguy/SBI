export interface TaxonomyCandidate {
  taxonomyId: string;
  label: string;
  keywords: string[];
}

// Mirrors objects the repo already knows; the taxonomy package replaces this seed.
const CANDIDATES: TaxonomyCandidate[] = [
  {
    keywords: ["boil", "kettle", "tea", "water"],
    label: "Kettle",
    taxonomyId: "household.kitchen.kettle",
  },
  {
    keywords: ["brew", "coffee", "coffee-pot", "pot"],
    label: "Coffee pot",
    taxonomyId: "household.kitchen.coffee-pot",
  },
  {
    keywords: ["brew", "pot", "tea", "teapot"],
    label: "Teapot",
    taxonomyId: "household.kitchen.teapot",
  },
];

const MAX_CANDIDATES = 5;

// Every query token must match; an empty query resolves to nothing.
export function resolveCandidates(
  query: string,
  candidates: TaxonomyCandidate[] = CANDIDATES,
): TaxonomyCandidate[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return [];
  }
  return candidates
    .filter((candidate) => {
      const haystacks = [
        candidate.label.toLowerCase(),
        candidate.taxonomyId.toLowerCase(),
        ...candidate.keywords,
      ];
      return tokens.every((token) => haystacks.some((haystack) => haystack.includes(token)));
    })
    .slice(0, MAX_CANDIDATES);
}
