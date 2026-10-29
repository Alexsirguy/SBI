import { VisualKind } from "@sbi/contracts";
import { describe, expect, it } from "vitest";
import { Domain } from "./schema";
import { SEED_TAXONOMY } from "./seed";
import { createTaxonomy } from "./taxonomy";
import { routeVisual, UnroutableError, VISUAL_ROUTES } from "./visual-routing";

const taxonomy = createTaxonomy(SEED_TAXONOMY);

describe("VISUAL_ROUTES", () => {
  it("has a route for every domain", () => {
    expect(Object.keys(VISUAL_ROUTES).sort()).toEqual([...Domain.options].sort());
  });

  it.each(Domain.options)("%s defaults to SVG and uses only allowlisted visual kinds", (domain) => {
    const family = VISUAL_ROUTES[domain];
    expect(family.primary).toBe("svg-diagram");
    for (const kind of family.optional) {
      expect(VisualKind.options).toContain(kind);
    }
    expect(family.interactions.length).toBeGreaterThan(0);
  });

  it("routes chemistry to molecular views and arts to colour canvases", () => {
    expect(VISUAL_ROUTES.chemistry.optional).toContain("molecular");
    expect(VISUAL_ROUTES.arts.optional).toContain("canvas-diagram");
    expect(VISUAL_ROUTES.biology.optional).not.toContain("molecular");
  });
});

describe("routeVisual", () => {
  it.each([
    ["object.honeycomb", "maths"],
    ["object.bicycle", "physics"],
    ["object.leaf", "biology"],
    ["object.rusty-nail", "chemistry"],
    ["object.acoustic-guitar", "arts"],
  ])("routes %s by its confirmed category to %s", (taxonomyId, domain) => {
    expect(routeVisual(taxonomy, taxonomyId)).toMatchObject({ domain, taxonomyId });
  });

  it("routes a category-level fallback too", () => {
    expect(routeVisual(taxonomy, "category.heating").domain).toBe("physics");
  });

  it("takes diagram labels from the taxonomy, not from the model", () => {
    expect(routeVisual(taxonomy, "object.bicycle").labels).toEqual([
      "Bicycle",
      "Chain",
      "Gears",
      "Brakes",
      "Pedals",
    ]);
  });

  it("refuses ids outside the taxonomy, such as a raw model label", () => {
    expect(() => routeVisual(taxonomy, "shiny red bike")).toThrow(UnroutableError);
  });

  it("refuses entries without a domain", () => {
    const loose = taxonomy.extend([{ id: "category.misc", kind: "category", label: "Misc" }]);
    expect(() => routeVisual(loose, "category.misc")).toThrow(/no domain/);
  });

  it("returns copies so callers cannot change the shared table", () => {
    routeVisual(taxonomy, "object.bicycle").optional.push("molecular");
    expect(VISUAL_ROUTES.physics.optional).not.toContain("molecular");
  });

  it("routes every seeded object", () => {
    const objects = taxonomy.entries().filter((entry) => entry.kind === "object");
    for (const entry of objects) {
      expect(() => routeVisual(taxonomy, entry.id)).not.toThrow();
    }
  });
});
