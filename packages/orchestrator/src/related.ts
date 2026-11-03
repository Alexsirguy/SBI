/** One catalogue entry as the concept graph sees it; concepts include those it inherits. */
export interface ConceptNode {
  id: string;
  label: string;
  kind: "category" | "object";
  parentId?: string;
  concepts: readonly string[];
}

export interface RelatedSuggestion {
  taxonomyId: string;
  label: string;
  /** The concept the two share, or "family" for objects under the same category. */
  via: string;
  /** Hops in the graph: 1 through a shared concept, 2 through the shared category. */
  distance: 1 | 2;
}

const norm = (concept: string) => concept.trim().toLowerCase();

/**
 * Next things to learn, from the concept graph only: objects that teach a concept this lesson
 * teaches come first, then objects in the same family. No click counts, so nothing chases clicks.
 */
export function relatedConcepts(
  nodes: readonly ConceptNode[],
  from: { taxonomyId?: string; concepts: readonly string[] },
  limit = 3,
): RelatedSuggestion[] {
  const own = nodes.find((node) => node.id === from.taxonomyId);
  const taught = new Set([...from.concepts, ...(own?.concepts ?? [])].map(norm));
  const family = own?.kind === "object" ? own.parentId : own?.id;
  const ranked = nodes
    .filter((node) => node.kind === "object" && node.id !== from.taxonomyId)
    .map((node) => {
      const shared = node.concepts.filter((concept) => taught.has(norm(concept)));
      if (shared.length > 0) {
        return { distance: 1 as const, node, shared: shared.length, via: shared[0] ?? "" };
      }
      if (family && node.parentId === family) {
        return { distance: 2 as const, node, shared: 0, via: "family" };
      }
      return undefined;
    })
    .filter((item) => item !== undefined)
    .sort(
      (a, b) =>
        a.distance - b.distance || b.shared - a.shared || a.node.label.localeCompare(b.node.label),
    );
  return ranked.slice(0, limit).map(({ distance, node, via }) => ({
    distance,
    label: node.label,
    taxonomyId: node.id,
    via,
  }));
}
