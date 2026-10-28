import { describe, expect, it } from "vitest";
import { resolveCandidates } from "./taxonomy";

describe("resolveCandidates", () => {
  it("matches labels, ids, and keywords case-insensitively", () => {
    expect(resolveCandidates("KETTLE").map((c) => c.taxonomyId)).toEqual([
      "household.kitchen.kettle",
    ]);
    expect(resolveCandidates("boil water").map((c) => c.taxonomyId)).toEqual([
      "household.kitchen.kettle",
    ]);
    expect(resolveCandidates("tea").map((c) => c.label)).toEqual(["Kettle", "Teapot"]);
  });

  it("requires every token and caps the list", () => {
    expect(resolveCandidates("tea spaceship")).toEqual([]);
    expect(resolveCandidates("   ")).toEqual([]);
    expect(resolveCandidates("e")).toHaveLength(3);
  });
});
