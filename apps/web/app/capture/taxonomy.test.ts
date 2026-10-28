import { describe, expect, it } from "vitest";
import { MAX_CANDIDATES, MIN_QUERY_LENGTH, searchTaxonomy, type SeedEntry } from "./taxonomy";

const labels = (query: string, seed?: SeedEntry[]) =>
  searchTaxonomy(query, seed).map((candidate) => candidate.label);

describe("searchTaxonomy", () => {
  it("matches labels and keywords regardless of case and punctuation", () => {
    expect(labels("KETTLE")).toEqual(["Kettle"]);
    expect(labels("kettle.")).toEqual(["Kettle"]);
    expect(labels("  boil   water ")).toEqual(["Kettle"]);
  });

  it("matches simple plurals", () => {
    expect(labels("kettles")).toEqual(["Kettle"]);
    expect(labels("bicycles")).toEqual(["Bicycle"]);
  });

  it("ranks exact label matches before prefix and partial matches", () => {
    expect(labels("pot")[0]).toBe("Coffee pot");
    expect(labels("tea")).toEqual(["Teapot", "Kettle"]);
  });

  it("never matches on internal taxonomy ids", () => {
    expect(labels("household")).toEqual([]);
    expect(labels("kitchen")).toEqual([]);
  });

  it(`ignores queries shorter than ${MIN_QUERY_LENGTH} letters`, () => {
    expect(labels("")).toEqual([]);
    expect(labels("e")).toEqual([]);
  });

  it(`returns at most ${MAX_CANDIDATES} candidates`, () => {
    const seed = Array.from({ length: 8 }, (_, i) => ({
      keywords: ["Widget"],
      label: `Widget ${i}`,
      taxonomyId: `test.widget-${i}`,
    }));
    expect(labels("widget", seed)).toHaveLength(MAX_CANDIDATES);
  });

  it("lowercases seed keywords so mixed-case data still matches", () => {
    expect(
      labels("glass", [{ keywords: ["Glass"], label: "Lens", taxonomyId: "optics.lens" }]),
    ).toEqual(["Lens"]);
  });

  it("returns the shared candidate shape", () => {
    expect(searchTaxonomy("kettle")).toEqual([
      { label: "Kettle", taxonomyId: "household.kitchen.kettle" },
    ]);
  });
});
