import { describe, expect, it } from "vitest";
import { relatedConcepts, type ConceptNode } from "./related";

const nodes: ConceptNode[] = [
  { concepts: ["heat transfer"], id: "category.kitchen", kind: "category", label: "Kitchen" },
  {
    concepts: ["boiling", "convection", "heat transfer"],
    id: "object.kettle",
    kind: "object",
    label: "Kettle",
    parentId: "category.kitchen",
  },
  {
    concepts: ["boiling", "heat transfer"],
    id: "object.saucepan",
    kind: "object",
    label: "Saucepan",
    parentId: "category.kitchen",
  },
  {
    concepts: ["convection", "boiling", "heat transfer"],
    id: "object.radiator",
    kind: "object",
    label: "Radiator",
    parentId: "category.home",
  },
  {
    concepts: ["heat transfer"],
    id: "object.toaster",
    kind: "object",
    label: "Toaster",
    parentId: "category.kitchen",
  },
  {
    concepts: ["gear ratio"],
    id: "object.bicycle",
    kind: "object",
    label: "Bicycle",
    parentId: "category.transport",
  },
  {
    concepts: [],
    id: "object.whisk",
    kind: "object",
    label: "Whisk",
    parentId: "category.kitchen",
  },
];

describe("relatedConcepts", () => {
  it("ranks shared concepts first, most shared first, then the same family", () => {
    const related = relatedConcepts(nodes, { concepts: [], taxonomyId: "object.kettle" }, 5);

    expect(related.map((item) => item.taxonomyId)).toEqual([
      "object.radiator",
      "object.saucepan",
      "object.toaster",
      "object.whisk",
    ]);
    expect(related[0]).toMatchObject({ distance: 1, via: "convection" });
    expect(related.at(-1)).toMatchObject({ distance: 2, via: "family" });
    expect(related.map((item) => item.taxonomyId)).not.toContain("object.bicycle");
  });

  it("works for subjects outside the catalogue from the lesson's own concepts", () => {
    const related = relatedConcepts(nodes, {
      concepts: ["Gear Ratio"],
      taxonomyId: "subject.unicycle",
    });
    expect(related).toEqual([
      { distance: 1, label: "Bicycle", taxonomyId: "object.bicycle", via: "gear ratio" },
    ]);
  });

  it("is the same every time for the same lesson, whatever anyone clicked", () => {
    const first = relatedConcepts(nodes, { concepts: [], taxonomyId: "object.kettle" });
    expect(relatedConcepts(nodes, { concepts: [], taxonomyId: "object.kettle" })).toEqual(first);
    expect(first).toHaveLength(3);
  });
});
