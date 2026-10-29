import type { Claim } from "@sbi/contracts";
import type { ClaimRepository } from "../repositories";

export class ClaimGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaimGraphError";
  }
}

/** Orders items so each comes after everything it depends on; rejects unknown ids and cycles. */
export function orderByDependencies<T>(
  items: T[],
  idOf: (item: T) => string,
  dependenciesOf: (item: T) => string[],
): T[] {
  const byId = new Map(items.map((item) => [idOf(item), item]));
  if (byId.size !== items.length) throw new ClaimGraphError("Claim ids must be unique");
  const ordered: T[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (id: string, path: string[]) => {
    if (state.get(id) === "done") return;
    if (state.get(id) === "visiting") {
      throw new ClaimGraphError(
        `Claims depend on each other in a cycle: ${[...path, id].join(" → ")}`,
      );
    }
    const item = byId.get(id);
    if (!item) throw new ClaimGraphError(`Unknown claim dependency "${id}"`);
    state.set(id, "visiting");
    for (const dependency of dependenciesOf(item)) visit(dependency, [...path, id]);
    state.set(id, "done");
    ordered.push(item);
  };
  for (const item of items) visit(idOf(item), []);
  return ordered;
}

export interface ClaimGraph {
  dependenciesOf(claimId: string, options?: { transitive?: boolean }): string[];
  dependentsOf(claimId: string, options?: { transitive?: boolean }): string[];
  /** Dependencies first, so a reader meets each step before what builds on it. */
  ordered(): Claim[];
}

function walk(start: string, next: (id: string) => string[], transitive: boolean): string[] {
  const seen = new Set<string>();
  const queue = [...next(start)];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    if (transitive) queue.push(...next(id));
  }
  return [...seen];
}

export function createClaimGraph(claims: Claim[]): ClaimGraph {
  const ordered = orderByDependencies(
    claims,
    (claim) => claim.claimId,
    (claim) => claim.dependsOn,
  );
  const dependencies = new Map(claims.map((claim) => [claim.claimId, claim.dependsOn]));
  const dependents = new Map<string, string[]>();
  for (const claim of claims) {
    for (const dependency of claim.dependsOn) {
      dependents.set(dependency, [...(dependents.get(dependency) ?? []), claim.claimId]);
    }
  }
  return {
    dependenciesOf: (claimId, { transitive = false } = {}) =>
      walk(claimId, (id) => dependencies.get(id) ?? [], transitive),
    dependentsOf: (claimId, { transitive = false } = {}) =>
      walk(claimId, (id) => dependents.get(id) ?? [], transitive),
    ordered: () => [...ordered],
  };
}

/** Every stored claim that rests on the given ones, directly or through other claims. */
export async function collectDependents(
  repository: ClaimRepository,
  claimIds: string[],
): Promise<string[]> {
  const seen = new Set<string>();
  let frontier = [...new Set(claimIds)];
  while (frontier.length > 0) {
    const found = (await Promise.all(frontier.map((id) => repository.findDependents(id)))).flat();
    frontier = found.map((claim) => claim.claimId).filter((id) => !seen.has(id));
    for (const id of frontier) seen.add(id);
  }
  for (const id of claimIds) seen.delete(id);
  return [...seen];
}
