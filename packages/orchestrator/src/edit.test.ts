import { join } from "node:path";
import { Lesson, lessonContentHash } from "@sbi/contracts";
import { loadFixtures } from "@sbi/testing";
import { describe, expect, it } from "vitest";
import { editLesson, LessonEditError } from "./edit";

const fixtures = loadFixtures(
  join(import.meta.dirname, "../../contracts/src/fixtures/lesson"),
).valid;
const load = (name: string) => Lesson.parse(fixtures.find((item) => item.name === name)?.data);
const merrill = load("merrill-guitar.json");
const NOW = new Date("2026-11-08T12:00:00.000Z");
const COPY_ID = "0192f1a0-0000-7000-8000-0000000000d7";
const none = { sections: [], tasks: [] };

describe("editLesson", () => {
  it("makes the teacher's own copy, marking only the sections that changed", async () => {
    const problem = merrill.sections[0];
    if (!problem) throw new Error("no section");
    const { lesson, editedSectionIds } = await editLesson(
      merrill,
      {
        ...none,
        sections: [
          { sectionId: problem.sectionId, text: "Why does a tighter string sound higher?" },
        ],
      },
      { id: () => COPY_ID, newCopy: true, now: NOW },
    );
    expect(lesson.lessonId).toBe(COPY_ID);
    expect(lesson.version).toBe(1);
    expect(lesson.sections[0]?.text).toBe("Why does a tighter string sound higher?");
    expect(lesson.sections[0]?.claimIds).toEqual(problem.claimIds);
    expect(editedSectionIds).toEqual([problem.sectionId]);
    expect(lesson.disclaimers).toContainEqual(
      expect.objectContaining({ kind: "teacher-edited", sectionIds: [problem.sectionId] }),
    );
    expect(lesson.reuse.cacheScope).toBe("private");
    expect(lesson.reuse.contentHash).toBe(await lessonContentHash(lesson));
    expect(lesson.reuse.contentHash).not.toBe(merrill.reuse.contentHash);
    // The source document is untouched.
    expect(merrill.sections[0]?.text).toBe(problem.text);
  });

  it("marks the section a changed question sits in, and keeps earlier marks on a new version", async () => {
    const first = await editLesson(
      merrill,
      { ...none, title: "Strings and pitch" },
      { id: () => COPY_ID, newCopy: true, now: NOW },
    );
    const guess = merrill.tasks.find((task) => task.taskId === "guess");
    if (!guess) throw new Error("no guess task");
    const second = await editLesson(
      first.lesson,
      {
        ...none,
        tasks: [
          {
            answerIndex: 1 - guess.answerIndex,
            feedback: [...guess.feedback].reverse(),
            options: [...guess.options].reverse(),
            prompt: guess.prompt,
            taskId: "guess",
          },
        ],
      },
      { newCopy: false, now: NOW },
    );
    expect(second.lesson.lessonId).toBe(COPY_ID);
    expect(second.lesson.version).toBe(2);
    expect(second.lesson.title).toBe("Strings and pitch");
    expect(second.editedSectionIds).toEqual(["activate"]);
    const notes = second.lesson.disclaimers?.filter((item) => item.kind === "teacher-edited");
    expect(notes).toHaveLength(1);
    expect(notes?.[0]?.sectionIds).toEqual(["activate"]);
  });

  it("never keeps an approval for words nobody reviewed", async () => {
    const approved = Lesson.parse({
      ...merrill,
      reviewStatus: "approved",
      reviewedAt: "2026-11-01T00:00:00.000Z",
      reviewedBy: "reviewer-1",
    });
    const { lesson } = await editLesson(
      approved,
      { ...none, summary: "A shorter summary." },
      { id: () => COPY_ID, newCopy: true, now: NOW },
    );
    expect(lesson.reviewStatus).toBe("auto-validated");
    expect(lesson.reviewedBy).toBeUndefined();
  });

  it("refuses an edit that changes nothing, names something missing, or breaks a question", async () => {
    const options = { id: () => COPY_ID, newCopy: true, now: NOW };
    await expect(editLesson(merrill, none, options)).rejects.toThrow(LessonEditError);
    await expect(
      editLesson(merrill, { ...none, sections: [{ sectionId: "nope", text: "x" }] }, options),
    ).rejects.toThrow(/no section/);
    await expect(
      editLesson(
        merrill,
        {
          ...none,
          tasks: [
            {
              answerIndex: 3,
              feedback: ["a", "b"],
              options: ["a", "b"],
              prompt: "?",
              taskId: "guess",
            },
          ],
        },
        options,
      ),
    ).rejects.toThrow(/right answer/);
  });
});
