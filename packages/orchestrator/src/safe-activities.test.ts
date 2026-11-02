import { describe, expect, it } from "vitest";
import { makeLesson } from "./lesson-fixture";
import { safeActivityCheck } from "./safe-activities";

function withIntegrate(text: string, audience = ["child"]) {
  const lesson = makeLesson({ audience });
  return {
    ...lesson,
    sections: lesson.sections.map((section) =>
      section.module === "integrate" ? { ...section, text } : section,
    ),
  };
}

describe("safeActivityCheck", () => {
  it("fails an everyday activity that asks a child to open a mains device, naming the section", async () => {
    const result = await safeActivityCheck.run(
      withIntegrate("This week, unscrew the plug on your kettle and look at the fuse."),
    );
    expect(result.passed).toBe(false);
    expect(result.sections).toEqual([
      {
        sectionId: "integrate-5",
        reason: expect.stringMatching(
          /^Asks the learner to open or poke into a mains-powered device/,
        ),
      },
    ]);
  });

  it("passes something safe to notice", async () => {
    const result = await safeActivityCheck.run(
      withIntegrate("This week, listen for the click when your kettle switches itself off."),
    );
    expect(result).toEqual({ name: "safe-activities", passed: true, details: [], sections: [] });
  });

  it("leaves a lesson for adults alone", async () => {
    const result = await safeActivityCheck.run(
      withIntegrate("Unscrew the plug and check the fuse rating.", ["adult"]),
    );
    expect(result.passed).toBe(true);
  });

  it("holds a general-audience lesson to the same rules, since a child may read it", async () => {
    const result = await safeActivityCheck.run(
      withIntegrate("Taste the berries on a hedge and compare them.", ["general"]),
    );
    expect(result.passed).toBe(false);
  });
});
