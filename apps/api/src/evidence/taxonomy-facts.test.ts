import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkSourcePolicy,
  createCitationResolver,
  EvidenceSnapshot,
  snapshotRepositories,
} from "@sbi/evidence";
import { SEED_TAXONOMY, TaxonomyEntry } from "@sbi/taxonomy";
import { describe, expect, it } from "vitest";

// Fails when a fact is added or reworded without re-running `pnpm --filter @sbi/api source:facts`.
const snapshot = EvidenceSnapshot.parse(
  JSON.parse(
    readFileSync(
      join(import.meta.dirname, "../../../../packages/evidence/snapshots/taxonomy-facts.json"),
      "utf8",
    ),
  ),
);
const facts = SEED_TAXONOMY.map((entry) => TaxonomyEntry.parse(entry)).flatMap((entry) =>
  entry.facts.map((fact) => ({ entryId: entry.id, ...fact })),
);
const claims = new Map(snapshot.claims.map((claim) => [claim.claimId, claim]));
const linked = facts.filter((fact) => fact.claimId);

describe("taxonomy facts and their evidence", () => {
  it("links each sourced fact to a stored claim with the same words", () => {
    for (const fact of linked) {
      const claim = claims.get(fact.claimId ?? "");
      expect(claim, fact.text).toBeDefined();
      expect(claim?.text).toBe(fact.text);
      expect(["supported", "qualified"]).toContain(claim?.status);
    }
  });

  it("keeps no claims that no fact uses", () => {
    expect([...claims.keys()].sort()).toEqual(linked.map((fact) => fact.claimId).sort());
  });

  it("covers every seeded fact in the snapshot, so unsourced ones were really tried", () => {
    const tried = new Set(snapshot.facts.map((fact) => fact.text));
    for (const fact of facts) expect(tried.has(fact.text), fact.text).toBe(true);
  });

  it("resolves every linked claim to stored excerpts", async () => {
    const resolver = createCitationResolver(await snapshotRepositories(snapshot));
    for (const fact of linked) {
      const resolved = await resolver.resolveClaim(fact.claimId ?? "");
      expect(resolved.excerpts.length).toBeGreaterThan(0);
    }
  });

  it("meets the two-source policy", () => {
    expect(checkSourcePolicy(snapshot.claims, snapshot.sources)).toEqual([]);
  });
});
