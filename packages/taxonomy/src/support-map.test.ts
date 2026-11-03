import { describe, expect, it } from "vitest";
import { prioritiseDemand } from "./demand";
import { LABELS_ES } from "./labels-es";
import { SEED_TAXONOMY } from "./seed";
import { supportMap } from "./support-map";
import { createTaxonomy } from "./taxonomy";

const taxonomy = createTaxonomy(SEED_TAXONOMY);

describe("supportMap", () => {
  it("lists every catalogue object once, under its category, marking checked facts", () => {
    const map = supportMap(taxonomy);
    const objects = map.flatMap((category) => category.objects);
    expect(objects).toHaveLength(SEED_TAXONOMY.filter((entry) => entry.kind === "object").length);
    const bicycle = objects.find((item) => item.id === "object.bicycle");
    expect(bicycle).toEqual({ curated: true, id: "object.bicycle", label: "Bicycle" });
    expect(objects.find((item) => item.id === "object.laptop")?.curated).toBe(false);
  });

  it("names everything in Spanish for es readers", () => {
    const map = supportMap(taxonomy, "es");
    expect(map.find((category) => category.id === "category.heating")?.label).toBe(
      "Calor y cocina",
    );
    const missing = SEED_TAXONOMY.filter((entry) => !LABELS_ES[entry.id]).map((entry) => entry.id);
    expect(missing).toEqual([]);
  });
});

describe("prioritiseDemand", () => {
  it("groups wordings by the thing named, adds on-demand lessons, and drops what is covered", () => {
    const priorities = prioritiseDemand(
      [
        { count: 3, term: "jet engine" },
        { count: 2, term: "boat engine" },
        { count: 4, term: "kettle" },
        { count: 1, term: "hovercraft" },
      ],
      [{ count: 2, subject: "rocket-engine" }],
      taxonomy,
    );

    expect(priorities[0]).toEqual({
      demand: 7,
      term: "jet engine",
      terms: ["jet engine", "boat engine", "rocket engine"],
    });
    expect(priorities.map((item) => item.term)).not.toContain("kettle");
    expect(priorities.at(-1)?.term).toBe("hovercraft");
  });
});
