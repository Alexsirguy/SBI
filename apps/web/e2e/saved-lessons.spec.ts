import { expect, test } from "@playwright/test";
import {
  SAMPLE_ANSWER,
  SAMPLE_LESSON,
  SAMPLE_SOURCES,
  sseFrames,
} from "../app/lesson/sample-lesson";
import { expectNoAxeViolations } from "./a11y";
import { mockApi, mockLesson } from "./mock-api";

const LESSON_URL = "/lesson?taxonomyId=object.magnifying-glass&label=Magnifying+glass";
const ACCOUNT = {
  accountId: "0192f1a0-0000-7000-8000-000000000001",
  email: "ada@example.com",
  emailVerified: true,
  firstName: "Ada",
  lastName: "Lovelace",
  linkedAt: null,
};
const SAVED = {
  lessonId: SAMPLE_LESSON.lessonId,
  savedAt: "2026-11-03T09:00:00.000Z",
  title: SAMPLE_LESSON.title,
  version: SAMPLE_LESSON.version,
};
const FULL = sseFrames([
  { type: "quick-answer", data: SAMPLE_ANSWER },
  { type: "lesson", data: SAMPLE_LESSON },
  { type: "sources", data: SAMPLE_SOURCES },
  { type: "visuals", data: { lessonId: SAMPLE_LESSON.lessonId, visuals: [] } },
]);

test("a signed-out learner is offered sign-in to save the lesson", async ({ page }) => {
  await mockLesson(page, FULL);
  await mockApi(page, "/account", () => ({
    json: { error: "Sign in to use your account." },
    status: 401,
  }));
  await page.goto(LESSON_URL);

  const link = page.getByRole("link", { name: "Sign in to save this lesson" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute(
    "href",
    /next=%2Flesson%3Flabel%3DMagnifying%2Bglass%26taxonomyId%3Dobject.magnifying-glass/,
  );
});

test("saving pins the version on screen and lists it with the saved lessons", async ({ page }) => {
  let saved: unknown;
  await mockLesson(page, FULL);
  await mockApi(page, "/account", () => ({ json: ACCOUNT }));
  await mockApi(page, "/account/lessons", () => ({ json: { lessons: saved ? [SAVED] : [] } }));
  await mockApi(page, "/account/lessons/save", (body) => {
    saved = body;
    return { json: SAVED };
  });
  await page.goto(LESSON_URL);

  await page.getByRole("button", { name: "Save lesson" }).click();

  await expect(page.getByRole("button", { name: /^Saved/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(saved).toEqual({ lessonId: SAMPLE_LESSON.lessonId, version: SAMPLE_LESSON.version });
  await expectNoAxeViolations(page);

  await page.goto("/account/lessons");
  await expect(page.getByRole("link", { name: SAMPLE_LESSON.title })).toHaveAttribute(
    "href",
    `/lesson/saved?id=${SAMPLE_LESSON.lessonId}`,
  );
  await expectNoAxeViolations(page);
});

test("a saved lesson opens as saved, without writing a new one", async ({ page }) => {
  let generated = false;
  await page.route("**/lessons", (route) => {
    generated = true;
    return route.abort();
  });
  await mockApi(page, "/account", () => ({ json: ACCOUNT }));
  await mockApi(page, "/account/lessons/open?", () => ({
    json: {
      lesson: SAMPLE_LESSON,
      savedAt: SAVED.savedAt,
      sources: SAMPLE_SOURCES,
      visuals: { lessonId: SAMPLE_LESSON.lessonId, visuals: [] },
    },
  }));
  await page.goto(`/lesson/saved?id=${SAMPLE_LESSON.lessonId}`);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SAMPLE_LESSON.title);
  await expect(page.getByText("You saved this version on")).toBeVisible();
  expect(generated).toBe(false);
  await expectNoAxeViolations(page);
});
