import type { TaxonomyEntry, TaxonomyFact } from "./schema";

export type FactClaimStatus = "supported" | "qualified" | "disputed" | "unsupported";

/** Facts a lesson may state: linked to a stored claim that a source supports or qualifies. */
export function sourcedFacts(
  entry: Pick<TaxonomyEntry, "facts">,
  statusOf: (claimId: string) => FactClaimStatus | undefined,
): TaxonomyFact[] {
  return entry.facts.filter((fact) => {
    const status = fact.claimId ? statusOf(fact.claimId) : undefined;
    return status === "supported" || status === "qualified";
  });
}
