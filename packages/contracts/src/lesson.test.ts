import { join } from "node:path";
import { describeContract, loadFixtures } from "@sbi/testing";
import { describe, expect, it } from "vitest";
import { canonicalJson, lessonContentHash } from "./content-hash";
import { Lesson } from "./lesson";

const dir = join(import.meta.dirname, "fixtures/lesson");
const full = Lesson.parse(
  loadFixtures(dir).valid.find(({ name }) => name === "kettle-full.json")?.data,
);

describeContract("Lesson", Lesson, dir);

describe("lessonContentHash", () => {
  it.each(loadFixtures(dir).valid)("matches the stored hash in $name", async ({ data }) => {
    const lesson = Lesson.parse(data);
    expect(await lessonContentHash(lesson)).toBe(lesson.reuse.contentHash);
  });

  it("ignores review and reuse metadata", async () => {
    const reviewed = {
      ...full,
      reviewedBy: "another-editor",
      reuse: { ...full.reuse, reuseCount: 99 },
    };
    expect(await lessonContentHash(reviewed)).toBe(await lessonContentHash(full));
  });

  it("changes when learner-facing text changes", async () => {
    const edited = { ...full, summary: `${full.summary} Edited.` };
    expect(await lessonContentHash(edited)).not.toBe(await lessonContentHash(full));
  });
});

describe("canonicalJson", () => {
  it("is independent of key order and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: [2, { d: undefined, c: 3 }] })).toBe(
      canonicalJson({ a: [2, { c: 3 }], b: 1 }),
    );
  });
});
