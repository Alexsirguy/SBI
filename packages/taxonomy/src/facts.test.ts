import { describe, expect, it } from "vitest";
import { sourcedFacts, type FactClaimStatus } from "./facts";
import { TaxonomyEntry, TaxonomyFact } from "./schema";
import { SEED_TAXONOMY } from "./seed";

const CLAIM = "0192f1a0-0000-7000-8000-000000000101";

describe("TaxonomyFact", () => {
  it("needs exactly one of a claim id or an unsourced marker", () => {
    const base = { scope: "category", text: "Rust forms when iron reacts with oxygen and water." };
    expect(TaxonomyFact.safeParse({ ...base, claimId: CLAIM }).success).toBe(true);
    expect(TaxonomyFact.safeParse({ ...base, unsourced: true }).success).toBe(true);
    expect(TaxonomyFact.safeParse(base).success).toBe(false);
    expect(TaxonomyFact.safeParse({ ...base, claimId: CLAIM, unsourced: true }).success).toBe(
      false,
    );
  });

  it("is satisfied by every seeded fact", () => {
    for (const entry of SEED_TAXONOMY) expect(() => TaxonomyEntry.parse(entry)).not.toThrow();
  });
});

describe("sourcedFacts", () => {
  const entry = {
    facts: [
      { scope: "category" as const, text: "Linked and supported.", claimId: CLAIM },
      { scope: "category" as const, text: "Not sourced.", unsourced: true as const },
      {
        scope: "category" as const,
        text: "Linked but disputed.",
        claimId: "0192f1a0-0000-7000-8000-000000000102",
      },
      {
        scope: "category" as const,
        text: "Linked to a missing claim.",
        claimId: "0192f1a0-0000-7000-8000-000000000103",
      },
    ],
  };
  const statuses: Record<string, FactClaimStatus> = {
    [CLAIM]: "qualified",
    "0192f1a0-0000-7000-8000-000000000102": "disputed",
  };

  it("keeps only facts whose claim is supported or qualified", () => {
    expect(sourcedFacts(entry, (id) => statuses[id]).map((fact) => fact.text)).toEqual([
      "Linked and supported.",
    ]);
  });
});
