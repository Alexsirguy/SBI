import { describe, expect, it } from "vitest";
import { normaliseGapTerm, searchObservations } from "./gaps";
import { SEED_TAXONOMY } from "./seed";
import { createTaxonomy } from "./taxonomy";

const taxonomy = createTaxonomy(SEED_TAXONOMY);

describe("normaliseGapTerm", () => {
  it("lowercases, drops filler words and punctuation", () => {
    expect(normaliseGapTerm("It's a Penny-Farthing!")).toBe("penny farthing");
    expect(normaliseGapTerm("  The   SPIRAL shell ")).toBe("spiral shell");
  });

  it("drops anything with digits, so numbers typed by mistake are never kept", () => {
    expect(normaliseGapTerm("call 07700 900123 about my 3d printer")).toBe("call about printer");
    expect(normaliseGapTerm("12345")).toBeNull();
  });

  it("caps the length and ignores empty input", () => {
    expect(normaliseGapTerm("one two three four five six seven eight")).toBe(
      "one two three four five six",
    );
    expect(normaliseGapTerm("x".repeat(100))?.length).toBe(60);
    expect(normaliseGapTerm("the a")).toBeNull();
  });
});

describe("searchObservations", () => {
  it("combines matches from separate observations", () => {
    const results = searchObservations(taxonomy, ["it has pedals", "two wheels", "I ride it"]);
    expect(results[0]?.label).toBe("Bicycle");
  });

  it("ranks objects matched by more observations first", () => {
    const results = searchObservations(taxonomy, ["boil", "tea"]);
    expect(results[0]?.label).toBe("Electric kettle");
    expect(results.map((r) => r.label)).toContain("Teapot");
  });

  it("returns nothing for observations the taxonomy cannot match", () => {
    expect(searchObservations(taxonomy, ["glows purple", "humming"])).toEqual([]);
    expect(searchObservations(taxonomy, [])).toEqual([]);
  });
});
