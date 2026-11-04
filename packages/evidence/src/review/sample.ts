/** What the sampler needs to know about each published lesson version. */
export interface SampleCandidate {
  lessonId: string;
  version: number;
  taxonomyId: string;
  safetyClass: "low" | "medium" | "high";
  /** How many learners were served it again; an error in a reused lesson reaches more of them. */
  reuseCount: number;
}

// A small seeded generator, so a sample can be drawn again and checked.
function random(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
}

/** "subject.*" for typed subjects, otherwise the catalogue family ("object", "phenomenon", …). */
const stratum = (candidate: SampleCandidate) =>
  `${candidate.taxonomyId.split(".")[0] ?? "other"}|${candidate.safetyClass}`;

/**
 * The sampling plan (docs/research/quality-review/sampling-plan.md): every high-safety lesson
 * and the most reused, then an even draw across family × safety strata up to `size`.
 */
export function sampleForReview(
  candidates: SampleCandidate[],
  options: { size: number; seed: number; mostReused?: number },
): SampleCandidate[] {
  const key = (candidate: SampleCandidate) => `${candidate.lessonId}@${candidate.version}`;
  const chosen = new Map<string, SampleCandidate>();
  const take = (candidate: SampleCandidate) => chosen.set(key(candidate), candidate);

  candidates.filter((candidate) => candidate.safetyClass === "high").forEach(take);
  [...candidates]
    .sort((a, b) => b.reuseCount - a.reuseCount || key(a).localeCompare(key(b)))
    .slice(0, options.mostReused ?? 5)
    .forEach(take);

  const next = random(options.seed);
  const strata = new Map<string, SampleCandidate[]>();
  for (const candidate of [...candidates].sort((a, b) => key(a).localeCompare(key(b)))) {
    if (chosen.has(key(candidate))) continue;
    const list = strata.get(stratum(candidate)) ?? [];
    list.push(candidate);
    strata.set(stratum(candidate), list);
  }
  // Round-robin over strata, a random member each time, so small strata are not drowned out.
  const queues = [...strata.keys()].sort().map((name) => strata.get(name) ?? []);
  while (chosen.size < options.size && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      if (chosen.size >= options.size || queue.length === 0) continue;
      const [picked] = queue.splice(Math.floor(next() * queue.length), 1);
      if (picked) take(picked);
    }
  }
  return [...chosen.values()];
}
