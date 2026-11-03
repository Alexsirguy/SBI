import type { CatalogGap } from "./gaps";
import type { Taxonomy } from "./taxonomy";

export interface DemandPriority {
  /** The most-used wording in the group, as a label to work from. */
  term: string;
  /** Every wording grouped under it, so related asks are seen together. */
  terms: string[];
  /** Times the catalogue missed it plus lessons taught on demand about it. */
  demand: number;
}

// The last word names the thing ("truck engine", "car engine"), so groups form on it.
const headword = (term: string) =>
  term
    .trim()
    .toLowerCase()
    .split(/[\s-]+/)
    .at(-1) ?? term;

/**
 * What to add to the catalogue next, by demand: gaps from recognition and observations plus
 * subjects taught on demand. Anything the catalogue already resolves is left out.
 */
export function prioritiseDemand(
  gaps: readonly Pick<CatalogGap, "term" | "count">[],
  taughtOnDemand: readonly { subject: string; count: number }[],
  taxonomy: Pick<Taxonomy, "resolve">,
  limit = 20,
): DemandPriority[] {
  const groups = new Map<string, Map<string, number>>();
  const add = (term: string, count: number) => {
    const wording = term.trim().toLowerCase();
    if (!wording || taxonomy.resolve(wording).length > 0) return;
    const group = groups.get(headword(wording)) ?? new Map<string, number>();
    group.set(wording, (group.get(wording) ?? 0) + count);
    groups.set(headword(wording), group);
  };
  for (const gap of gaps) add(gap.term, gap.count);
  for (const taught of taughtOnDemand) add(taught.subject.replace(/-/g, " "), taught.count);
  return [...groups.values()]
    .map((group) => {
      const terms = [...group].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      return {
        demand: terms.reduce((sum, [, count]) => sum + count, 0),
        term: terms[0]?.[0] ?? "",
        terms: terms.map(([term]) => term),
      };
    })
    .sort((a, b) => b.demand - a.demand || a.term.localeCompare(b.term))
    .slice(0, limit);
}
