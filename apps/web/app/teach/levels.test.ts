import { CURRICULA } from "@sbi/taxonomy/curriculum";
import { describe, expect, it } from "vitest";
import { CURRICULUM_LEVELS } from "./levels";

describe("CURRICULUM_LEVELS", () => {
  it("matches the curricula, so the teacher page offers only levels the API accepts", () => {
    expect(CURRICULUM_LEVELS).toEqual({ ng: CURRICULA.ng.levels, us: CURRICULA.us.levels });
  });
});
