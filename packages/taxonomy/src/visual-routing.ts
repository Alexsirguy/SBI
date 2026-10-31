import type { VisualKind } from "@sbi/contracts";
import type { Domain } from "./schema";
import type { Taxonomy } from "./taxonomy";

export type Interaction =
  "label-parts" | "adjust-quantities" | "explore-pattern" | "compare-results";

export interface VisualFamily {
  /** The kind suggested first for the domain; the generator may still pick another (ADR 0014). */
  primary: VisualKind;
  /** Other kinds that suit the domain, in order of preference. */
  optional: VisualKind[];
  interactions: Interaction[];
}

export interface VisualRoute extends VisualFamily {
  taxonomyId: string;
  domain: Domain;
  /** Diagram labels, taken from the taxonomy only. */
  labels: string[];
}

export const VISUAL_ROUTES: Readonly<Record<Domain, VisualFamily>> = {
  maths: {
    primary: "graph",
    optional: ["playground"],
    interactions: ["explore-pattern", "adjust-quantities"],
  },
  physics: {
    primary: "mechanism",
    optional: ["graph", "playground"],
    interactions: ["label-parts", "adjust-quantities"],
  },
  biology: {
    primary: "process",
    optional: ["molecule", "playground"],
    interactions: ["label-parts"],
  },
  chemistry: {
    primary: "molecule",
    optional: ["process", "graph"],
    interactions: ["label-parts", "compare-results"],
  },
  arts: {
    primary: "playground",
    optional: ["process"],
    interactions: ["compare-results", "explore-pattern"],
  },
};

export class UnroutableError extends Error {
  constructor(taxonomyId: string, reason: string) {
    super(`${taxonomyId}: ${reason}`);
    this.name = "UnroutableError";
  }
}

// Accepts only a confirmed taxonomy id: model boxes, masks or labels must never shape a diagram.
export function routeVisual(taxonomy: Taxonomy, taxonomyId: string): VisualRoute {
  const entry = taxonomy.get(taxonomyId);
  if (!entry) {
    throw new UnroutableError(taxonomyId, "not in the taxonomy");
  }
  const domain = taxonomy.domainOf(taxonomyId);
  if (!domain) {
    throw new UnroutableError(taxonomyId, "has no domain to route by");
  }
  const family = VISUAL_ROUTES[domain];
  return {
    taxonomyId,
    domain,
    primary: family.primary,
    optional: [...family.optional],
    interactions: [...family.interactions],
    labels: [entry.label, ...entry.parts.map((part) => part.label)],
  };
}
