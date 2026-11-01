import { describe, expect, it } from "vitest";
import type { Lesson } from "@sbi/contracts";
import {
  citationCheck,
  misconceptionCheck,
  runLessonChecks,
  schemaCheck,
  type LessonCheck,
} from "./checks";
import { CLAIM_A, CLAIM_B, makeLesson } from "./lesson-fixture";

const UNKNOWN = "123e4567-e89b-12d3-a456-426614174009";

function withSections(sections: Lesson["sections"]): Lesson {
  return { ...makeLesson(), sections };
}

describe("schemaCheck", () => {
  it("passes a conforming lesson", async () => {
    expect(await schemaCheck.run(makeLesson())).toMatchObject({ name: "schema", passed: true });
  });

  it("names the offending field", async () => {
    const broken = withSections([
      {
        sectionId: "short-answer-1",
        module: "short-answer",
        text: "Heat snaps a switch.",
        claimIds: [UNKNOWN],
      },
    ]);

    const result = await schemaCheck.run(broken);

    expect(result.passed).toBe(false);
    expect(result.details.join("\n")).toContain(UNKNOWN);
  });
});

describe("citationCheck", () => {
  it("passes when refs resolve and every claim is cited", async () => {
    expect(await citationCheck.run(makeLesson())).toMatchObject({
      name: "citations",
      passed: true,
    });
  });

  it("fails unknown refs and orphan claims", async () => {
    const broken = withSections([
      {
        sectionId: "short-answer-9",
        module: "short-answer",
        text: "Heat snaps a switch.",
        claimIds: [UNKNOWN],
      },
    ]);

    const result = await citationCheck.run(broken);

    expect(result.passed).toBe(false);
    expect(result.details.join("\n")).toContain(`Unknown claim "${UNKNOWN}"`);
    expect(result.details.join("\n")).toContain("never cited");
  });
});

describe("citationCheck on uncited sections", () => {
  const cited = makeLesson().sections;

  it("fails a factual section that cites no claim", async () => {
    const lesson = withSections([
      ...cited,
      { sectionId: "history-4", module: "history", text: "Kettles date from 1891.", claimIds: [] },
    ]);
    const result = await citationCheck.run(lesson);
    expect(result.passed).toBe(false);
    expect(result.details).toContain('Section "history-4" states facts without citing a claim');
  });

  it("allows check-thinking questions without citations", async () => {
    const lesson = withSections([
      ...cited,
      {
        sectionId: "check-thinking-4",
        module: "check-thinking",
        text: "What would happen without the strip?",
        claimIds: [],
      },
    ]);
    expect((await citationCheck.run(lesson)).passed).toBe(true);
  });
});

describe("citationCheck on a Merrill lesson", () => {
  it("lets problem, activate and integrate go uncited, and apply when its challenges cite", async () => {
    const lesson = makeLesson();
    expect(
      lesson.sections.filter((section) => section.claimIds.length === 0).map((s) => s.module),
    ).toEqual(["problem", "activate", "integrate"]);
    expect((await citationCheck.run(lesson)).passed).toBe(true);

    const sceneOnly = {
      ...lesson,
      sections: lesson.sections.map((section) =>
        section.module === "apply" ? { ...section, claimIds: [] } : section,
      ),
      tasks: lesson.tasks.map((task) =>
        task.module === "apply" ? { ...task, claimIds: [CLAIM_A, CLAIM_B] } : task,
      ),
    };
    expect((await citationCheck.run(sceneOnly)).passed).toBe(true);

    const uncited = {
      ...sceneOnly,
      tasks: lesson.tasks.map((task) => ({ ...task, claimIds: [] })),
    };
    const result = await citationCheck.run(uncited);
    expect(result.details).toContain('Section "apply-4" states facts without citing a claim');
  });

  it("counts a claim cited only by a challenge as cited", async () => {
    const lesson = makeLesson();
    const moved = {
      ...lesson,
      sections: lesson.sections.map((section) =>
        section.module === "apply" ? { ...section, claimIds: [CLAIM_A] } : section,
      ),
      tasks: lesson.tasks.map((task) =>
        task.taskId === "apply-2" ? { ...task, claimIds: [CLAIM_B] } : task,
      ),
    };
    expect(await citationCheck.run(moved)).toMatchObject({ passed: true, details: [] });
  });
});

describe("misconceptionCheck", () => {
  it("passes settled lessons with no notes", async () => {
    expect(await misconceptionCheck.run(makeLesson())).toMatchObject({ passed: true });
  });

  it("requires notes when unsettled claims are cited", async () => {
    const lesson = makeLesson();
    const [first, second] = lesson.claims;
    if (!first || !second) throw new Error("Fixture needs two claims");
    const disputed: Lesson = {
      ...lesson,
      claims: [{ ...first, status: "disputed", uncertainty: "Two sources disagree." }, second],
    };

    expect((await misconceptionCheck.run(disputed)).passed).toBe(false);
    expect(
      (
        await misconceptionCheck.run({
          ...disputed,
          misconceptionNotes: ["The click is not the water boiling."],
        })
      ).passed,
    ).toBe(true);
  });
});

describe("runLessonChecks", () => {
  const pass: LessonCheck = {
    name: "pass",
    run: async () => ({ name: "pass", passed: true, details: [] }),
  };
  const fail: LessonCheck = {
    name: "fail",
    run: async () => ({ name: "fail", passed: false, details: ["broken"] }),
  };

  it("auto-validates a generated lesson when every check passes", async () => {
    const { lesson, report } = await runLessonChecks(makeLesson(), [pass, schemaCheck]);

    expect(report.passed).toBe(true);
    expect(report.results.map((item) => item.name)).toEqual(["pass", "schema"]);
    expect(lesson.reviewStatus).toBe("auto-validated");
    expect(lesson.reuse.validatedAt).toBe(report.checkedAt);
  });

  it("leaves the lesson generated when any check fails", async () => {
    const { lesson, report } = await runLessonChecks(makeLesson(), [pass, fail]);

    expect(report.passed).toBe(false);
    expect(lesson.reviewStatus).toBe("generated");
    expect(lesson.reuse.validatedAt).toBeUndefined();
  });

  it("never restamps a lesson past generated", async () => {
    const { lesson } = await runLessonChecks(makeLesson({ reviewStatus: "auto-validated" }), [
      pass,
    ]);

    expect(lesson.reviewStatus).toBe("auto-validated");
    expect(lesson.reuse.validatedAt).toBeUndefined();
  });

  it("audits the auto-validation move", async () => {
    const audits: { from: string; to: string; by: string }[] = [];
    await runLessonChecks(makeLesson(), [pass], {
      onAudit: (audit) => void audits.push(audit),
    });

    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ from: "generated", to: "auto-validated", by: "system" });
  });
});
