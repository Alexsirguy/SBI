import { describe, expect, it } from "vitest";
import { readingEase, readingLevelCheck } from "./reading";
import { makeLesson } from "./lesson-fixture";

const EASY =
  "The sun is hot. It warms the sea. Small drops lift in the air. " +
  "White clouds form up high. Soft rain falls down.";

const HARD =
  "Thermodynamic disequilibrium in heterogeneous aqueous systems precipitates " +
  "convective overturning characterized by nonlinear oscillations in temperature " +
  "gradients, notwithstanding quasi-stationary boundary layer approximations.";

function lessonWithText(text: string, readingLevel: "simple" | "plain" | "technical") {
  const lesson = makeLesson({ readingLevel });
  return {
    ...lesson,
    sections: lesson.sections.map((section) => ({ ...section, text })),
  };
}

describe("readingEase", () => {
  it("scores plain words far above dense prose", () => {
    expect(readingEase(EASY)).toBeGreaterThan(readingEase(HARD) + 40);
  });
});

describe("readingLevelCheck", () => {
  it("passes easy text at every level and hard text only as technical", async () => {
    for (const level of ["simple", "plain", "technical"] as const) {
      expect((await readingLevelCheck.run(lessonWithText(EASY, level))).passed).toBe(true);
    }
    expect((await readingLevelCheck.run(lessonWithText(HARD, "technical"))).passed).toBe(true);
  });

  it("fails dense prose declared simple or plain", async () => {
    for (const level of ["simple", "plain"] as const) {
      const result = await readingLevelCheck.run(lessonWithText(HARD, level));
      expect(result.passed).toBe(false);
      expect(result.details.join("\n")).toContain(level);
    }
  });
});
