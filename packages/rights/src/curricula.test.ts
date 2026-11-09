import { describe, expect, it } from "vitest";
import { CURRICULUM_SOURCES, curriculumSource } from "./curricula";

describe("curriculum sources", () => {
  it("has one complete record per framework", () => {
    const ids = CURRICULUM_SOURCES.map((source) => source.frameworkId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const source of CURRICULUM_SOURCES) {
      for (const value of Object.values(source)) expect(value, source.frameworkId).not.toBe("");
      expect(source.termsUrl).toMatch(/^https:\/\//);
      expect(source.reviewDueOn > source.checkedOn).toBe(true);
    }
  });

  it("carries the notices the terms ask for", () => {
    expect(curriculumSource("ngss")?.notice).toContain("registered trademark of WestEd");
    expect(curriculumSource("ccss-math")?.notice).toContain("© Copyright 2010");
    expect(curriculumSource("nerdc-sss")?.notice).toContain("our own");
    expect(curriculumSource("unknown")).toBeUndefined();
  });
});
