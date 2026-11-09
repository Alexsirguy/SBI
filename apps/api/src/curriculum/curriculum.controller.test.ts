import { Curricula, CurriculumTopicResult, CurriculumTopics } from "@sbi/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { CURRICULUM } from "../tokens";
import { fakeCurriculum } from "../testing/test-curriculum";
import { startTestApp, type TestApp } from "../testing/test-app";

let test: TestApp | undefined;
afterEach(async () => {
  await test?.app.close();
  test = undefined;
});

async function start() {
  const curriculum = fakeCurriculum();
  test = await startTestApp(undefined, undefined, undefined, (builder) =>
    builder.overrideProvider(CURRICULUM).useValue(curriculum.repository),
  );
  return { curriculum, test };
}

describe("curriculum routes", () => {
  it("lists both curricula with their subjects and each framework's notice", async () => {
    const { test } = await start();
    const body = Curricula.parse(await (await test.get("/curricula")).json());
    expect(body.curricula.map((item) => item.curriculum).sort()).toEqual(["ng", "us"]);
    const ng = body.curricula.find((item) => item.curriculum === "ng");
    expect(ng?.subjects.map((subject) => subject.subjectId)).toContain("ng-jss-maths");
    const us = body.curricula.find((item) => item.curriculum === "us");
    const ngss = us?.frameworks.find((framework) => framework.id === "ngss");
    expect(ngss?.notice).toContain("registered trademark of WestEd");
    expect(
      us?.subjects.find((s) => s.subjectId === "us-physical-science")?.topicCount,
    ).toBeGreaterThan(0);
  });

  it("filters topics by subject and level", async () => {
    const { test } = await start();
    const response = await test.get(
      "/curricula/topics?curriculum=ng&subject=ng-physics&level=SSS2",
    );
    const { topics } = CurriculumTopics.parse(await response.json());
    expect(topics.length).toBeGreaterThan(0);
    for (const topic of topics)
      expect(topic).toMatchObject({ level: "SSS2", subjectId: "ng-physics" });
  });

  it("reads one topic, still answers for a retired one, and 404s an unknown code", async () => {
    const { curriculum, test } = await start();
    const code = "NG-PHY-SSS2-WAVES-LIGHT-REFRACTION";
    curriculum.retired.set(code, new Date("2026-11-10T09:00:00Z"));
    const { topic } = CurriculumTopicResult.parse(
      await (await test.get(`/curricula/topic?code=${code}`)).json(),
    );
    expect(topic).toMatchObject({ code, retiredAt: "2026-11-10T09:00:00.000Z" });
    expect((await test.get("/curricula/topic?code=NOPE-1")).status).toBe(404);
    expect((await test.get("/curricula/topics?curriculum=fr")).status).toBe(400);
  });
});
