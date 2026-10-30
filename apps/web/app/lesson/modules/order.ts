import type { Lesson } from "@sbi/contracts";

type Concept = Lesson["concepts"][number];

/** Concepts with every prerequisite before what builds on it; ties keep the lesson's order. */
export function conceptsInOrder(concepts: Concept[]): Concept[] {
  const byId = new Map(concepts.map((concept) => [concept.conceptId, concept]));
  const placed = new Set<string>();
  const visiting = new Set<string>();
  const ordered: Concept[] = [];
  const place = (concept: Concept) => {
    // A cycle is not the reader's to fix; the concept is placed where the loop is found.
    if (placed.has(concept.conceptId) || visiting.has(concept.conceptId)) return;
    visiting.add(concept.conceptId);
    for (const id of concept.prerequisites) {
      const prerequisite = byId.get(id);
      if (prerequisite) place(prerequisite);
    }
    visiting.delete(concept.conceptId);
    placed.add(concept.conceptId);
    ordered.push(concept);
  };
  concepts.forEach(place);
  return ordered;
}

/** Splits an explanation into its steps, one sentence each, for a causal sequence. */
export function steps(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((step) => step.trim())
    .filter((step) => step.length > 0);
}
