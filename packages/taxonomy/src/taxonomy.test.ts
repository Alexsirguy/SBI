import { describe, expect, it } from "vitest";
import { SEED_TAXONOMY } from "./seed";
import { createTaxonomy, MAX_SEARCH_RESULTS, MIN_QUERY_LENGTH } from "./taxonomy";

const taxonomy = createTaxonomy(SEED_TAXONOMY);
const labels = (query: string) => taxonomy.search(query).map((match) => match.label);
const resolvedIds = (label: string) =>
  taxonomy.resolve(label).map(({ entry, part }) => (part ? part.id : entry.id));

describe("createTaxonomy", () => {
  it("validates the seed", () => {
    expect(taxonomy.entries().length).toBe(SEED_TAXONOMY.length);
  });

  it("rejects duplicate ids, unknown parents, orphan objects and cycles", () => {
    const root = { id: "category.a", kind: "category", label: "A" } as const;
    expect(() => createTaxonomy([root, root])).toThrow(/Duplicate/);
    expect(() =>
      createTaxonomy([{ id: "object.x", kind: "object", label: "X", parentId: "category.none" }]),
    ).toThrow(/unknown parent/);
    expect(() => createTaxonomy([{ id: "object.x", kind: "object", label: "X" }])).toThrow(
      /needs a parent/,
    );
    expect(() =>
      createTaxonomy([
        { id: "category.a", kind: "category", label: "A", parentId: "category.b" },
        { id: "category.b", kind: "category", label: "B", parentId: "category.a" },
      ]),
    ).toThrow(/cycle/);
  });

  it("rejects invalid ids", () => {
    expect(() => createTaxonomy([{ id: "bad id", kind: "category", label: "A" }])).toThrow();
  });
});

describe("extend", () => {
  it("adds entries without changing the original", () => {
    const extended = taxonomy.extend([
      { id: "object.kite", kind: "object", label: "Kite", parentId: "category.motion" },
    ]);
    expect(extended.get("object.kite")?.label).toBe("Kite");
    expect(extended.domainOf("object.kite")).toBe("physics");
    expect(taxonomy.get("object.kite")).toBeUndefined();
  });

  it("cannot redefine an existing id", () => {
    expect(() =>
      taxonomy.extend([
        { id: "object.bicycle", kind: "object", label: "Trike", parentId: "category.motion" },
      ]),
    ).toThrow(/Duplicate/);
  });
});

describe("resolve", () => {
  it("resolves labels and aliases regardless of case, punctuation and plurals", () => {
    expect(resolvedIds("Bicycle")).toEqual(["object.bicycle"]);
    expect(resolvedIds("BIKE!")).toEqual(["object.bicycle"]);
    expect(resolvedIds("electric kettles")).toEqual(["object.electric-kettle"]);
    expect(resolvedIds("tree leaves")).toEqual(["object.leaf"]);
  });

  it("resolves a part to its object", () => {
    const [match] = taxonomy.resolve("chain");
    expect(match?.entry.id).toBe("object.bicycle");
    expect(match?.part?.label).toBe("Chain");
    expect(resolvedIds("sprocket")).toEqual(["object.bicycle:gears"]);
  });

  it("prefers a whole object over a part with the same name", () => {
    expect(resolvedIds("convex lens")).toEqual(["object.magnifying-glass"]);
    expect(resolvedIds("veins")).toEqual(["object.veins-wrist"]);
  });

  it("returns every object for a part name they share", () => {
    expect(
      taxonomy
        .resolve("lens")
        .map(({ entry }) => entry.id)
        .sort(),
    ).toEqual(["object.eyeglasses", "object.magnifying-glass"]);
    expect(resolvedIds("lenses").sort()).toEqual([
      "object.eyeglasses:lenses",
      "object.magnifying-glass:lens",
    ]);
  });

  it("covers look-alikes that live runs named but the first seed lacked", () => {
    expect(resolvedIds("stovetop kettle")).toEqual(["object.stovetop-kettle"]);
    expect(resolvedIds("tumbler")).toEqual(["object.drinking-glass"]);
    expect(resolvedIds("glass")).toEqual(["object.drinking-glass"]);
    expect(resolvedIds("cargo bike")).toEqual(["object.bicycle"]);
    expect(
      taxonomy
        .resolve("kettle")
        .map(({ entry }) => entry.id)
        .sort(),
    ).toEqual(["object.electric-kettle", "object.stovetop-kettle"]);
  });

  it("returns nothing for unknown labels and never matches ids", () => {
    expect(taxonomy.resolve("spaceship")).toEqual([]);
    expect(taxonomy.resolve("object.bicycle")).toEqual([]);
  });
});

describe("search", () => {
  it("matches names and keywords and ranks names first", () => {
    expect(labels("kettle")).toEqual(["Electric kettle", "Stovetop kettle"]);
    expect(labels("  boil   water ")).toEqual(["Electric kettle"]);
    // Names first ("tea cup", "tea kettle", "tea pot"), then the keyword match.
    expect(labels("tea").slice(0, 3).sort()).toEqual(["Mug", "Stovetop kettle", "Teapot"]);
    expect(labels("tea")).toContain("Electric kettle");
  });

  it("offers only objects, never categories or internal ids", () => {
    expect(labels("magnets")[0]).toBe("Magnet");
    expect(labels("category")).toEqual([]);
    expect(labels("object")).toEqual([]);
  });

  it(`ignores queries shorter than ${MIN_QUERY_LENGTH} letters and caps results`, () => {
    expect(labels("e")).toEqual([]);
    expect(taxonomy.search("a", 50)).toEqual([]);
    expect(labels("ca").length).toBeLessThanOrEqual(MAX_SEARCH_RESULTS);
  });

  it("returns the shared candidate shape", () => {
    expect(taxonomy.search("bike")).toEqual([{ label: "Bicycle", taxonomyId: "object.bicycle" }]);
  });
});

describe("hierarchy, concepts and facts", () => {
  it("walks ancestors and inherits the domain", () => {
    expect(taxonomy.ancestors("object.bicycle").map((entry) => entry.id)).toEqual([
      "category.mechanisms",
    ]);
    expect(taxonomy.domainOf("object.honeycomb")).toBe("maths");
    expect(taxonomy.domainOf("object.unknown")).toBeUndefined();
  });

  it("inherits concepts from categories", () => {
    expect(taxonomy.concepts("object.bicycle")).toEqual([
      "gear ratio",
      "mechanical advantage",
      "force",
      "energy transfer",
    ]);
  });

  it("separates category facts from object-specific ones", () => {
    const general = taxonomy.facts("object.bicycle", "category");
    const specific = taxonomy.facts("object.bicycle", "object-specific");
    expect(general.length).toBeGreaterThan(0);
    expect(specific.length).toBeGreaterThan(0);
    expect(general.every((fact) => fact.scope === "category")).toBe(true);
    expect(specific.every((fact) => fact.scope === "object-specific")).toBe(true);
    expect(general.map((fact) => fact.text)).not.toEqual(
      expect.arrayContaining(specific.map((fact) => fact.text)),
    );
  });

  it("does not inherit object-specific facts from a category", () => {
    const extended = taxonomy.extend([
      {
        id: "category.vehicles",
        kind: "category",
        label: "Vehicles",
        domain: "physics",
        facts: [
          { scope: "category", text: "Vehicles move people or things.", unsourced: true },
          { scope: "object-specific", text: "Some vehicles are electric.", unsourced: true },
        ],
      },
      { id: "object.scooter", kind: "object", label: "Scooter", parentId: "category.vehicles" },
    ]);
    expect(extended.facts("object.scooter", "category").map((fact) => fact.text)).toEqual([
      "Vehicles move people or things.",
    ]);
    expect(extended.facts("object.scooter", "object-specific")).toEqual([]);
  });

  it("covers every labelled object in seed set 2.0.0", () => {
    const seedLabels = [
      "Bicycle",
      "Electric kettle",
      "Magnifying glass",
      "Playground swing",
      "Magnetic compass",
      "Feather",
      "Electrical socket",
      "Honeycomb",
      "Sunflower",
      "Pine cone",
      "Football",
      "Dice",
      "Snowflake",
      "Nautilus shell",
      "Leaf",
      "Mushroom",
      "Honey bee",
      "Banana",
      "Cactus",
      "Veins on a wrist",
      "Rusty nail",
      "Candle",
      "Ice cubes",
      "Glass of water",
      "Salt crystals",
      "Cut apple",
      "Soap bubble",
      "Cleaning products",
      "Acoustic guitar",
      "Stained glass window",
      "Paint palette",
      "Drum",
      "Clay pot",
      "Abstract painting",
      "Medicine tablets",
    ];
    expect(seedLabels.filter((label) => taxonomy.resolve(label).length === 0)).toEqual([]);
  });
});
