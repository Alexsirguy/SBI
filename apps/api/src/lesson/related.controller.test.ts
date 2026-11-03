import { join } from "node:path";
import { Lesson } from "@sbi/contracts";
import { loadFixtures } from "@sbi/testing";
import { afterEach, describe, expect, it } from "vitest";
import {
  fakeGaps,
  fakeMedia,
  fakeRecognition,
  startTestApp,
  type TestApp,
} from "../testing/test-app";
import { EVENT_SINK, LESSONS } from "../tokens";

const kettle = Lesson.parse(
  loadFixtures(
    join(import.meta.dirname, "../../../../packages/contracts/src/fixtures/lesson"),
  ).valid.find((item) => item.name === "kettle-full.json")?.data,
);

async function start() {
  const events: unknown[] = [];
  const test = await startTestApp(fakeMedia(), fakeRecognition(), fakeGaps(), (builder) =>
    builder
      .overrideProvider(LESSONS)
      .useValue({
        get: async (id: string, version: number) =>
          id === kettle.lessonId && version === kettle.version ? kettle : undefined,
      })
      .overrideProvider(EVENT_SINK)
      .useValue((event: unknown) => void events.push(event)),
  );
  return { events, test };
}

describe("related lessons and next-concept events", () => {
  let test: TestApp | undefined;

  afterEach(async () => {
    await test?.app.close();
  });

  it("suggests other catalogue objects through shared concepts, not the lesson's own", async () => {
    const s = await start();
    test = s.test;

    const response = await test.get(
      `/lessons/related?lessonId=${kettle.lessonId}&version=${kettle.version}`,
    );

    expect(response.status).toBe(200);
    const { related } = (await response.json()) as {
      related: { taxonomyId: string; distance: number }[];
    };
    expect(related.length).toBeGreaterThan(0);
    expect(related.map((item) => item.taxonomyId)).not.toContain(kettle.taxonomyId);
    expect(related[0]?.distance).toBe(1);
  });

  it("answers 404 for an unknown lesson", async () => {
    const s = await start();
    test = s.test;
    const response = await test.get(`/lessons/related?lessonId=${kettle.lessonId}&version=99`);
    expect(response.status).toBe(404);
  });

  it("records a followed suggestion with ids and rank only", async () => {
    const s = await start();
    test = s.test;

    const response = await test.post("/events/next-concept", {
      fromLessonId: kettle.lessonId,
      rank: 1,
      toTaxonomyId: "object.saucepan",
    });

    expect(await response.json()).toEqual({ ok: true });
    expect(s.events).toEqual([
      expect.objectContaining({
        fromLessonId: kettle.lessonId,
        rank: 1,
        toTaxonomyId: "object.saucepan",
        type: "next-concept",
      }),
    ]);
    expect(Object.keys(s.events[0] as object).sort()).toEqual([
      "at",
      "fromLessonId",
      "rank",
      "toTaxonomyId",
      "type",
    ]);
  });
});
