import { describe, expect, it } from "vitest";
import { conceptsInOrder, steps } from "./order";

const concept = (conceptId: string, prerequisites: string[] = []) => ({
  conceptId,
  label: conceptId,
  prerequisites,
});

describe("conceptsInOrder", () => {
  it("puts each prerequisite before what builds on it, keeping the lesson's order otherwise", () => {
    const ordered = conceptsInOrder([
      concept("magnification", ["refraction", "angle"]),
      concept("refraction"),
      concept("angle", ["refraction"]),
      concept("lens"),
    ]);
    expect(ordered.map((item) => item.conceptId)).toEqual([
      "refraction",
      "angle",
      "magnification",
      "lens",
    ]);
  });

  it("still lists every concept when prerequisites loop or are missing", () => {
    const ordered = conceptsInOrder([
      concept("a", ["b"]),
      concept("b", ["a"]),
      concept("c", ["x"]),
    ]);
    expect(ordered.map((item) => item.conceptId).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("steps", () => {
  it("splits an explanation into sentence steps without breaking numbers", () => {
    expect(
      steps("The lens bends light. Your eye sees a 2.5 times larger angle! Then it looks big."),
    ).toEqual([
      "The lens bends light.",
      "Your eye sees a 2.5 times larger angle!",
      "Then it looks big.",
    ]);
  });
});
