import { join } from "node:path";
import { Lesson, OpenedClass, TeacherClasses, type Lesson as LessonRecord } from "@sbi/contracts";
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
import { hashJoinCode } from "./join-code";

const fixture = Lesson.parse(
  loadFixtures(
    join(import.meta.dirname, "../../../../packages/contracts/src/fixtures/lesson"),
  ).valid.find((item) => item.name === "kettle-full.json")?.data,
);
const kettle: LessonRecord = {
  ...fixture,
  assumptions: ["I live at sea level"],
  reuse: { ...fixture.reuse, cacheScope: "private" },
};
const TEACHER = {
  age: 34,
  email: "teacher@example.com",
  firstName: "Ngozi",
  lastName: "Okafor",
  password: "conduction convection radiation",
};

async function start() {
  const mail = fakeMailer();
  const saved = fakeSavedLessons();
  const classes = fakeClasses();
  const test = await startTestApp(fakeMedia(), fakeRecognition(), fakeGaps(), (builder) =>
    builder
      .overrideProvider(LESSONS)
      .useValue({
        get: async (id: string, version: number) =>
          id === kettle.lessonId && version === 1 ? kettle : undefined,
        save: async () => undefined,
      })
      .overrideProvider(LESSON_EVIDENCE)
      .useValue({ claims: { getMany: async () => [] }, sources: { getMany: async () => [] } })
      .overrideProvider(SAVED_LESSONS)
      .useValue(saved.repository)
      .overrideProvider(CLASSES)
      .useValue(classes.repository)
      .overrideProvider(MAILER)
      .useValue(mail.send),
  );
  const signUp = async (person: typeof TEACHER, verify = true) => {
    const before = mail.sent.length;
    const cookie = sessionFrom(await test.post("/auth/sign-up", person, { origin: WEB_ORIGIN }));
    if (verify) {
      const token = mail.linkIn(mail.sent[before]);
      await test.post("/auth/verify", { token }, { origin: WEB_ORIGIN });
    }
    return { cookie, origin: WEB_ORIGIN };
  };
  return { classes, saved, signUp, test };
}

async function teacherWithClass(s: Awaited<ReturnType<typeof start>>) {
  const headers = await s.signUp(TEACHER);
  expect((await s.test.post("/classes/educator", {}, headers)).status).toBe(200);
  const created = await s.test.post(
    "/classes/create",
    { curriculum: "ng", level: "SSS2", name: "SSS2 Physics" },
    headers,
  );
  expect(created.status).toBe(200);
  const body = (await created.json()) as { class: { classId: string }; joinCode: string };
  return { classId: body.class.classId, headers, joinCode: body.joinCode };
}

describe("classes", () => {
  let test: TestApp | undefined;

  afterEach(async () => {
    await test?.app.close();
  });

  it("turns teaching tools on only for confirmed adults", async () => {
    const s = await start();
    test = s.test;
    expect((await test.post("/classes/educator", {}, { origin: WEB_ORIGIN })).status).toBe(401);

    const teen = await s.signUp({ ...TEACHER, age: 16, email: "teen@example.com" });
    const refused = await test.post("/classes/educator", {}, teen);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ error: expect.stringContaining("18") });

    const unconfirmed = await s.signUp({ ...TEACHER, email: "new@example.com" }, false);
    expect((await test.post("/classes/educator", {}, unconfirmed)).status).toBe(403);

    const adult = await s.signUp(TEACHER);
    expect(TeacherClasses.parse(await (await test.get("/classes", adult)).json())).toEqual({
      classes: [],
      educator: false,
    });
    expect((await test.post("/classes/create", { name: "Physics" }, adult)).status).toBe(403);
    expect((await test.post("/classes/educator", {}, adult)).status).toBe(200);
    expect((await (await test.get("/classes", adult)).json()) as object).toMatchObject({
      educator: true,
    });
  });

  it("shows the join code once and keeps only its hash", async () => {
    const s = await start();
    test = s.test;
    const { classId, headers, joinCode } = await teacherWithClass(s);

    expect(joinCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    const row = s.classes.rows.get(classId);
    expect(row?.joinCodeHash).toBe(hashJoinCode(joinCode));
    expect(JSON.stringify(row)).not.toContain(joinCode.replace("-", ""));

    const listed = TeacherClasses.parse(await (await test.get("/classes", headers)).json());
    expect(listed.classes[0]).toMatchObject({
      codeHint: joinCode.slice(-2),
      controls: { audienceLock: null, blockedCategories: [], tutorEnabled: true },
      curriculum: "ng",
      level: "SSS2",
      name: "SSS2 Physics",
    });
    expect(JSON.stringify(listed)).not.toContain(joinCode);
  });

  it("checks a level belongs to the class's curriculum", async () => {
    const s = await start();
    test = s.test;
    const { classId, headers } = await teacherWithClass(s);
    const wrong = await test.post("/classes/update", { classId, level: "9-12" }, headers);
    expect(wrong.status).toBe(400);

    const moved = await test.post("/classes/update", { classId, curriculum: "us" }, headers);
    expect(await moved.json()).toMatchObject({ class: { curriculum: "us", level: null } });
    const set = await test.post("/classes/update", { classId, level: "9-12" }, headers);
    expect(await set.json()).toMatchObject({ class: { level: "9-12" } });
  });

  it("keeps each teacher's classes to themselves", async () => {
    const s = await start();
    test = s.test;
    const { classId } = await teacherWithClass(s);
    const other = await s.signUp({ ...TEACHER, email: "other@example.com" });
    await test.post("/classes/educator", {}, other);

    expect((await test.post("/classes/update", { classId, name: "Mine" }, other)).status).toBe(404);
    expect((await test.post("/classes/code", { classId }, other)).status).toBe(404);
    expect(TeacherClasses.parse(await (await test.get("/classes", other)).json()).classes).toEqual(
      [],
    );
  });

  it("opens for pupils by code with no sign-in, and stops when rotated or archived", async () => {
    const s = await start();
    test = s.test;
    const { classId, headers, joinCode } = await teacherWithClass(s);

    // Typed loosely, the way a pupil copies it from the board.
    const loose = joinCode.toLowerCase().replace("-", " ").replace(/0/g, "o");
    const opened = await test.get(`/class?code=${encodeURIComponent(loose)}`);
    expect(opened.status).toBe(200);
    const body = OpenedClass.parse(await opened.json());
    expect(body).toEqual({
      controls: { audienceLock: null, blockedCategories: [], tutorEnabled: true },
      curriculum: "ng",
      lessons: [],
      level: "SSS2",
      name: "SSS2 Physics",
    });
    expect(JSON.stringify(body)).not.toMatch(/teacher@|Okafor|accountId|classId/);

    const rotated = await test.post("/classes/code", { classId }, headers);
    const { joinCode: fresh } = (await rotated.json()) as { joinCode: string };
    expect((await test.get(`/class?code=${joinCode}`)).status).toBe(404);
    expect((await test.get(`/class?code=${fresh}`)).status).toBe(200);

    await test.post("/classes/archive", { archived: true, classId }, headers);
    expect((await test.get(`/class?code=${fresh}`)).status).toBe(404);
    await test.post("/classes/archive", { archived: false, classId }, headers);
    expect((await test.get(`/class?code=${fresh}`)).status).toBe(200);

    expect((await test.get("/class?code=UUUU")).status).toBe(400);
  });

  it("adds only saved lessons, at the saved version, and serves them without assumptions", async () => {
    const s = await start();
    test = s.test;
    const { classId, headers, joinCode } = await teacherWithClass(s);
    const add = () =>
      s.test.post("/classes/lessons/add", { classId, lessonId: kettle.lessonId }, headers);

    expect((await add()).status).toBe(404);
    await test.post("/account/lessons/save", { lessonId: kettle.lessonId, version: 1 }, headers);
    expect(await (await add()).json()).toMatchObject({
      class: { lessons: [{ lessonId: kettle.lessonId, title: kettle.title, version: 1 }] },
    });

    const opened = await test.get(`/class/lesson?code=${joinCode}&lessonId=${kettle.lessonId}`);
    expect(opened.status).toBe(200);
    const lesson = ((await opened.json()) as { lesson: LessonRecord }).lesson;
    expect(lesson.title).toBe(kettle.title);
    expect(lesson.assumptions).toEqual([]);

    await test.post("/classes/lessons/remove", { classId, lessonId: kettle.lessonId }, headers);
    expect(
      (await test.get(`/class/lesson?code=${joinCode}&lessonId=${kettle.lessonId}`)).status,
    ).toBe(404);
  });

  it("refuses the tutor when the class has it off", async () => {
    const s = await start();
    test = s.test;
    const { classId, headers, joinCode } = await teacherWithClass(s);
    await test.post(
      "/classes/update",
      {
        classId,
        controls: { audienceLock: "teen", blockedCategories: ["weapons"], tutorEnabled: false },
      },
      headers,
    );
    const asked = await test.post(
      "/tutor/turns",
      {
        classCode: joinCode,
        lessonId: kettle.lessonId,
        lessonVersion: 1,
        sessionId: "0192f1a0-0000-7000-8000-0000000000f1",
        text: "Why does it click off?",
      },
      { origin: WEB_ORIGIN },
    );
    expect(asked.status).toBe(403);
    expect(await asked.json()).toMatchObject({ error: expect.stringContaining("tutor off") });
  });

  it("puts classes in the account export", async () => {
    const s = await start();
    test = s.test;
    const { headers } = await teacherWithClass(s);
    const exported = (await (await test.get("/account/export", headers)).json()) as {
      teaching: unknown;
    };
    expect(exported.teaching).toMatchObject({
      classes: [{ curriculum: "ng", level: "SSS2", lessons: [], name: "SSS2 Physics" }],
      educator: true,
    });
  });
});
