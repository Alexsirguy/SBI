import { join } from "node:path";
import { Lesson, OpenedLesson, SavedLessons, type Lesson as LessonRecord } from "@sbi/contracts";
import { loadFixtures } from "@sbi/testing";
import { afterEach, describe, expect, it } from "vitest";
import {
  fakeGaps,
  fakeMedia,
  fakeRecognition,
  startTestApp,
  WEB_ORIGIN,
  type TestApp,
} from "../testing/test-app";
import { fakeSavedLessons, sessionFrom } from "../testing/test-auth";
import { LESSON_EVIDENCE, LESSONS, SAVED_LESSONS } from "../tokens";

const kettle = Lesson.parse(
  loadFixtures(
    join(import.meta.dirname, "../../../../packages/contracts/src/fixtures/lesson"),
  ).valid.find((item) => item.name === "kettle-full.json")?.data,
);
const ADA = {
  age: 14,
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  password: "analytical engine notes",
};

async function start() {
  const versions = new Map<number, LessonRecord>([
    [1, kettle],
    [2, { ...kettle, title: "Why a kettle boils water (revised)", version: 2 }],
  ]);
  const saved = fakeSavedLessons();
  const media = fakeMedia();
  const test = await startTestApp(media, fakeRecognition(), fakeGaps(), (builder) =>
    builder
      .overrideProvider(LESSONS)
      .useValue({
        get: async (id: string, version: number) =>
          id === kettle.lessonId ? versions.get(version) : undefined,
      })
      .overrideProvider(LESSON_EVIDENCE)
      .useValue({ claims: { getMany: async () => [] }, sources: { getMany: async () => [] } })
      .overrideProvider(SAVED_LESSONS)
      .useValue(saved.repository),
  );
  const cookie = sessionFrom(await test.post("/auth/sign-up", ADA, { origin: WEB_ORIGIN }));
  const headers = { cookie, origin: WEB_ORIGIN };
  return { headers, media, saved, test, versions };
}

describe("saved lessons", () => {
  let test: TestApp | undefined;

  afterEach(async () => {
    await test?.app.close();
  });

  it("needs a signed-in account", async () => {
    const s = await start();
    test = s.test;

    expect((await test.get("/account/lessons")).status).toBe(401);
    const save = await test.post(
      "/account/lessons/save",
      { lessonId: kettle.lessonId, version: 1 },
      { origin: WEB_ORIGIN },
    );
    expect(save.status).toBe(401);
  });

  it("opens exactly the saved version, even after a newer one exists", async () => {
    const s = await start();
    test = s.test;

    const save = await test.post(
      "/account/lessons/save",
      { lessonId: kettle.lessonId, version: 1 },
      s.headers,
    );
    expect(await save.json()).toMatchObject({ title: kettle.title, version: 1 });

    const opened = OpenedLesson.parse(
      await (await test.get(`/account/lessons/open?lessonId=${kettle.lessonId}`, s.headers)).json(),
    );
    expect(opened.lesson.version).toBe(1);
    expect(opened.lesson.title).toBe(kettle.title);
    expect(opened.visuals.lessonId).toBe(kettle.lessonId);
  });

  it("takes the title from the stored lesson and refuses unknown lessons", async () => {
    const s = await start();
    test = s.test;

    const forged = await test.post(
      "/account/lessons/save",
      { lessonId: kettle.lessonId, title: "<script>", version: 2 },
      s.headers,
    );
    expect(await forged.json()).toMatchObject({ title: "Why a kettle boils water (revised)" });
    const missing = await test.post(
      "/account/lessons/save",
      { lessonId: "0192f1a0-0000-7000-8000-00000000dead", version: 1 },
      s.headers,
    );
    expect(missing.status).toBe(404);
  });

  it("lists saved lessons and removes them", async () => {
    const s = await start();
    test = s.test;
    await test.post("/account/lessons/save", { lessonId: kettle.lessonId, version: 2 }, s.headers);

    const listed = SavedLessons.parse(await (await test.get("/account/lessons", s.headers)).json());
    expect(listed.lessons.map((item) => item.version)).toEqual([2]);

    await test.post("/account/lessons/remove", { lessonId: kettle.lessonId }, s.headers);
    expect(
      SavedLessons.parse(await (await test.get("/account/lessons", s.headers)).json()).lessons,
    ).toEqual([]);
    const gone = await test.get(`/account/lessons/open?lessonId=${kettle.lessonId}`, s.headers);
    expect(gone.status).toBe(404);
  });

  it("never keeps a photo when a lesson is saved", async () => {
    const s = await start();
    test = s.test;

    await test.post("/account/lessons/save", { lessonId: kettle.lessonId, version: 1 }, s.headers);

    expect(s.media.kept.size).toBe(0);
    expect(s.media.consents.size).toBe(0);
  });

  it("keeps one account's saved lessons from another", async () => {
    const s = await start();
    test = s.test;
    await test.post("/account/lessons/save", { lessonId: kettle.lessonId, version: 1 }, s.headers);
    const other = sessionFrom(
      await test.post(
        "/auth/sign-up",
        { ...ADA, email: "grace@example.com" },
        { origin: WEB_ORIGIN },
      ),
    );

    const response = await test.get(`/account/lessons/open?lessonId=${kettle.lessonId}`, {
      cookie: other,
    });

    expect(response.status).toBe(404);
  });
});
