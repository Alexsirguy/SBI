import { Claim, EvidenceSource, IsoDateTime } from "@sbi/contracts";
import { z } from "zod";
import type { EvidenceRepositories } from "./claims/persist";
import { createMemoryEvidenceRepositories } from "./memory";

/** A committed set of claims and their sources, so ids stay stable across databases. */
export const EvidenceSnapshot = z.object({
  generatedAt: IsoDateTime,
  judge: z.string().min(1),
  facts: z.array(
    z.object({
      key: z.string().min(1),
      text: z.string().min(1),
      claimId: z.uuid().optional(),
      outcome: z.string().min(1),
    }),
  ),
  claims: z.array(Claim),
  sources: z.array(EvidenceSource),
});

export type EvidenceSnapshot = z.infer<typeof EvidenceSnapshot>;

/** Writes a snapshot into any repositories; sources first, since claims point at them. */
export async function loadSnapshot(snapshot: EvidenceSnapshot, repositories: EvidenceRepositories) {
  for (const source of snapshot.sources) await repositories.sources.save(source);
  for (const claim of snapshot.claims) await repositories.claims.save(claim);
}

export async function snapshotRepositories(snapshot: EvidenceSnapshot) {
  const repositories = createMemoryEvidenceRepositories();
  await loadSnapshot(snapshot, repositories);
  return repositories;
}
