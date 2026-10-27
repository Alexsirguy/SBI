import { describe, expect, it } from "vitest";
import { labelMatches, percentile } from "./match";
import { loadSeedSet } from "./seed-set";

const prompts = loadSeedSet().prompts;
const bicycle = prompts.find((prompt) => prompt.taxonomyId === "object.bicycle");
if (!bicycle) throw new Error("seed set needs a bicycle");

describe("labelMatches", () => {
  it.each(["Bicycle", "a road bike", "bikes", "Mountain Bike"])("accepts %s", (label) => {
    expect(labelMatches(label, bicycle)).toBe(true);
  });

  it.each(["motorcycle wheel", "car", "", "b"])("rejects %s", (label) => {
    expect(labelMatches(label, bicycle)).toBe(false);
  });
});

describe("percentile", () => {
  it("uses nearest rank", () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 100], 95)).toBe(100);
    expect(percentile([], 50)).toBe(0);
  });
});
