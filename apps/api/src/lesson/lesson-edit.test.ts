import { join } from "node:path";
import { Lesson, OpenedClass, type Lesson as LessonRecord } from "@sbi/contracts";
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
import { fakeMailer, fakeSavedLessons, sessionFrom } from "../testing/test-auth";
import { fakeClasses } from "../testing/test-classes";
import { CLASSES, LESSON_EVIDENCE, LESSONS, MAILER, SAVED_LESSONS } from "../tokens";

const merrill = Lesson.parse(
  loadFixtures(
    join(import.meta.dirname, "../../../../packages/contracts/src/fixtures/lesson"),
  ).valid.find((item) => item.name === "merrill-guitar.json")?.data,
);
const TEACHER = {
  age: 34,
  email: "teacher@example.com",
  firstName: "Ngozi",
  lastName: "Okafor",
  password: "conduction convection radiation",
};

async function start() {
  const mail = fakeMailer();
  const stored = new Map<string, LessonRecord>([[`${merrill.lessonId}@1`, merrill]]);
  const test = await startTestApp(fakeMedia(), fakeRecognition(), fakeGaps(), (builder) =>
    builder
      .overrideProvider(LESSONS)
      .useValue({
        get: async (id: string, version: number) => stored.get(`${id}@${version}`),
        save: async (lesson: LessonRecord) =>
          void stored.set(`${lesson.lessonId}@${lesson.version}`, lesson),
      })
      .overrideProvider(LESSON_EVIDENCE)
      .useValue({ claims: { getMany: async () => [] }, sources: { getMany: async () => [] } })
      .overrideProvider(SAVED_LESSONS)
      .useValue(fakeSavedLessons().repository)
      .overrideProvider(CLASSES)
      .useValue(fakeClasses().repository)
      .overrideProvider(MAILER)
      .useValue(mail.send),
  );
  const signUp = async (person = TEACHER) => {
    const before = mail.sent.length;
    const cookie = sessionFrom(await test.post("/auth/sign-up", person, { origin: WEB_ORIGIN }));
    await test.post(
      "/auth/verify",
      { token: mail.linkIn(mail.sent[before]) },
      { origin: WEB_ORIGIN },
    );
    return { cookie, origin: WEB_ORIGIN };
  };
  return { signUp, stored, test };
}

describe("editing a saved lesson", () => {
  let test: TestApp | undefined;

  afterEach(async () => {
    await test?.app.close();
  });

  it("makes the teacher's own copy, swaps it into their class, and versions later edits", async () => {
    const s = await start();
    test = s.test;
    const headers = await s.signUp();
    await test.post("/classes/educator", {}, headers);
    const created = (await (
      await test.post("/classes/create", { name: "SSS2 Physics" }, headers)
    ).json()) as { class: { classId: string }; joinCode: string };
    await test.post("/account/lessons/save", { lessonId: merrill.lessonId, version: 1 }, headers);
    await test.post(
      "/classes/lessons/add",
      { classId: created.class.classId, lessonId: merrill.lessonId },
      headers,
    );

    const first = await test.post(
      "/account/lessons/edit",
      {
        lessonId: merrill.lessonId,
        sections: [{ sectionId: "problem", text: "Why does a tighter string sound higher?" }],
      },
      headers,
    );
    expect(first.status).toBe(200);
    const body = (await first.json()) as {
      classesUpdated: number;
      lesson: { lessonId: string; version: number };
    };
    expect(body.classesUpdated).toBe(1);
    expect(body.lesson.lessonId).not.toBe(merrill.lessonId);
    expect(body.lesson.version).toBe(1);
    // The original stays exactly as it was.
    expect(s.stored.get(`${merrill.lessonId}@1`)?.sections[0]?.text).toBe(
      merrill.sections[0]?.text,
    );
    const copy = s.stored.get(`${body.lesson.lessonId}@1`);
    expect(copy?.disclaimers).toContainEqual(
      expect.objectContaining({ kind: "teacher-edited", sectionIds: ["problem"] }),
    );

    const opened = OpenedClass.parse(
      await (await test.get(`/class?code=${created.joinCode}`)).json(),
    );
    expect(opened.lessons).toEqual([
      expect.objectContaining({ lessonId: body.lesson.lessonId, version: 1 }),
    ]);

    const second = await test.post(
      "/account/lessons/edit",
      { lessonId: body.lesson.lessonId, title: "Strings and pitch" },
      headers,
    );
    expect(await second.json()).toMatchObject({
      classesUpdated: 1,
      lesson: { lessonId: body.lesson.lessonId, title: "Strings and pitch", version: 2 },
    });
    const pupil = await (
      await test.get(`/class/lesson?code=${created.joinCode}&lessonId=${body.lesson.lessonId}`)
    ).json();
    expect(pupil).toMatchObject({ lesson: { title: "Strings and pitch", version: 2 } });
  });

  it("is for teachers only, and refuses an edit that changes nothing", async () => {
    const s = await start();
    test = s.test;
    const headers = await s.signUp();
    await test.post("/account/lessons/save", { lessonId: merrill.lessonId, version: 1 }, headers);
    const edit = { lessonId: merrill.lessonId, title: "Mine now" };
    expect((await test.post("/account/lessons/edit", edit, headers)).status).toBe(403);

    await test.post("/classes/educator", {}, headers);
    const unchanged = await test.post(
      "/account/lessons/edit",
      { lessonId: merrill.lessonId },
      headers,
    );
    expect(unchanged.status).toBe(400);
    expect(await unchanged.json()).toMatchObject({ error: "Nothing was changed." });
    const missing = await test.post(
      "/account/lessons/edit",
      { lessonId: "0192f1a0-0000-7000-8000-0000000000ff", title: "x" },
      headers,
    );
    expect(missing.status).toBe(404);
  });
});
