import { describe, expect, it } from "vitest";
import { TEST_PACK } from "./offline-test-pack";
import { memoryPacks, packFileName } from "./packs";

describe("pack store", () => {
  it("saves, lists newest first, opens and removes packs", async () => {
    const store = memoryPacks();
    const older = {
      ...TEST_PACK,
      exportedAt: "2026-11-01T00:00:00.000Z",
      lesson: {
        ...TEST_PACK.lesson,
        lessonId: "0192f1a0-0000-7000-8000-0000000000c9",
        title: "Older",
      },
    };
    await store.save(older);
    await store.save(TEST_PACK);
    expect((await store.list()).map((pack) => pack.title)).toEqual([
      TEST_PACK.lesson.title,
      "Older",
    ]);
    expect((await store.get(TEST_PACK.lesson.lessonId))?.withheld).toHaveLength(1);
    await store.remove(older.lesson.lessonId);
    expect(await store.list()).toHaveLength(1);
  });

  it("names the file after the lesson", () => {
    expect(packFileName(TEST_PACK)).toMatch(/^[a-z0-9-]+\.sbipack\.json$/);
  });
});
