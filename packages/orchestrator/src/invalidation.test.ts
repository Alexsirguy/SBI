import { join } from "node:path";
import { Lesson, type EvidenceInvalidated } from "@sbi/contracts";
import { loadFixtures } from "@sbi/testing";
import { describe, expect, it } from "vitest";
import { createLessonInvalidator, isReusable } from "./invalidation";
import type { LessonRepository } from "./lesson-repository";

const fixtures = join(import.meta.dirname, "../../contracts/src/fixtures/lesson");
const lesson = Lesson.parse(
  loadFixtures(fixtures).valid.find((item) => item.name === "kettle-full.json")?.data,
);

function memoryLessons(initial: Lesson[]): LessonRepository & { saved: Lesson[] } {
  const store = new Map(initial.map((item) => [`${item.lessonId}@${item.version}`, item]));
  const saved: Lesson[] = [];
  return {
    saved,
    async save(item) {
      store.set(`${item.lessonId}@${item.version}`, item);
      saved.push(item);
    },
    async get(lessonId, version) {
      return store.get(`${lessonId}@${version}`);
    },
    async latest() {
      return undefined;
    },
    async findByIntent() {
      return [];
    },
    async findByClaimIds(claimIds) {
      return [...store.values()].filter((item) =>
        item.claims.some((claim) => claimIds.includes(claim.claimId)),
      );
    },
  };
}

const event = (claimIds: string[]): EvidenceInvalidated => ({
  type: "evidence.invalidated",
  sourceId: "0192f1a0-0000-7000-8000-000000000001",
  reason: "changed",
  claimIds,
  detectedAt: "2026-10-29T10:00:00Z",
});

describe("createLessonInvalidator", () => {
  it("marks lessons that show an invalidated claim as stale, with the reason", async () => {
    const lessons = memoryLessons([lesson]);
    const claimId = lesson.claims[0]?.claimId ?? "";

    expect(await createLessonInvalidator(lessons).publish(event([claimId]))).toBe(1);

    const stale = await lessons.get(lesson.lessonId, lesson.version);
    expect(stale?.reuse).toMatchObject({
      sourceFreshness: "stale",
      invalidationReason:
        "Source 0192f1a0-0000-7000-8000-000000000001 no longer says what we quoted (2026-10-29).",
    });
    expect(stale?.reuse.contentHash).toBe(lesson.reuse.contentHash);
    expect(isReusable(stale as Lesson)).toBe(false);
  });

  it("leaves unrelated and already-stale lessons alone", async () => {
    const lessons = memoryLessons([lesson]);
    const invalidator = createLessonInvalidator(lessons);
    expect(await invalidator.publish(event(["0192f1a0-0000-7000-8000-0000000000ff"]))).toBe(0);
    await invalidator.publish(event([lesson.claims[0]?.claimId ?? ""]));
    expect(await invalidator.publish(event([lesson.claims[0]?.claimId ?? ""]))).toBe(0);
    expect(lessons.saved).toHaveLength(1);
  });

  it("ignores events with no claims", async () => {
    expect(await createLessonInvalidator(memoryLessons([lesson])).publish(event([]))).toBe(0);
  });
});

describe("isReusable", () => {
  it("allows fresh lessons and refuses stale or rejected ones", () => {
    expect(isReusable(lesson)).toBe(lesson.reuse.sourceFreshness !== "stale");
    expect(isReusable({ ...lesson, reviewStatus: "rejected" })).toBe(false);
  });
});
