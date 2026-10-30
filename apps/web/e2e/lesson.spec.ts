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

const FULL = sseFrames([
  { type: "progress", data: { stage: "researching", message: "Researching 3 questions." } },
  { type: "quick-answer", data: SAMPLE_ANSWER },
  { type: "lesson", data: SAMPLE_LESSON },
  { type: "sources", data: SAMPLE_SOURCES },
  { type: "visuals", data: { lessonId: SAMPLE_LESSON.lessonId, visuals: [] } },
]);

test("shows section placeholders and progress while the lesson is on its way", async ({ page }) => {
  await mockLesson(page, null);
  await page.goto(LESSON_URL);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lesson: Magnifying glass");
  await expect(page.getByRole("status")).toHaveText("Starting your lesson…");
  const nav = page.getByRole("navigation", { name: "Lesson sections" });
  await expect(nav.getByRole("listitem")).toHaveCount(8);
  await expect(nav.getByRole("link")).toHaveCount(0);
  await expect(page.locator(".lesson-sections")).toHaveAttribute("aria-busy", "true");
  await expectNoAxeViolations(page);
});

test("reads the quick answer, notices and every section in order once streamed", async ({
  page,
}) => {
  await mockLesson(page, FULL);
  await page.goto(LESSON_URL);
  await expect(page.getByRole("status")).toHaveText("Lesson ready.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SAMPLE_LESSON.title);
  await expect(page.getByRole("complementary", { name: "Before you read" })).toContainText(
    "general knowledge",
  );
  await expect(page.getByRole("region", { name: "Quick answer" })).toContainText(
    SAMPLE_ANSWER.shortAnswer,
  );
  const headings = SAMPLE_LESSON.sections.map((section) => section.heading ?? "");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Quick answer",
    "In this lesson",
    ...headings,
    "Sources",
    "Tell us what you think",
  ]);

  const nav = page.getByRole("navigation", { name: "Lesson sections" });
  await nav.getByRole("link", { name: "Reading stones" }).click();
  await expect(page).toHaveURL(/#section-history$/);
  await expect(page.locator(".lesson-sections")).toHaveAttribute("aria-busy", "false");
  await expectNoAxeViolations(page);
});

test("citation markers lead to the source list, which credits each source", async ({ page }) => {
  await mockLesson(page, FULL);
  await page.goto(LESSON_URL);
  const seeing = page.getByRole("region", { name: "Small print looks larger" });
  await expect(seeing).toContainText("Based on limited evidence");
  await seeing.getByRole("link", { name: "Source 1: 2.8: The Simple Magnifier" }).click();
  await expect(page).toHaveURL(/#source-1$/);
  const list = page.getByRole("region", { name: "Sources" });
  await expect(list.getByRole("listitem").first()).toContainText("CC BY 4.0");
  await expect(list).toContainText("Lesson written 30 October 2026");
  await expectNoAxeViolations(page);
});

test("check your thinking explains after the learner has had a go, without scoring", async ({
  page,
}) => {
  await mockLesson(page, FULL);
  await page.goto(LESSON_URL);
  const check = page.getByRole("region", { name: "Does the word grow?" });
  await check
    .getByLabel("Your thinking (optional, not saved or marked)")
    .fill("It only looks bigger.");
  await check.getByRole("button", { name: "Compare with the explanation" }).click();
  await expect(check.getByRole("heading", { name: "The explanation" })).toBeVisible();
  await expect(check).toContainText(SAMPLE_LESSON.misconceptionNotes[0] ?? "");
  // The feedback explains; it never grades the learner's answer.
  await expect(check.locator(".check-feedback")).not.toContainText(/score|correct|wrong|points/i);
  await expectNoAxeViolations(page);
});

test("explains a failure and tries again on request", async ({ page }) => {
  let calls = 0;
  await page.route("**/lessons", async (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "content-type",
          "access-control-allow-methods": "GET, POST",
        },
        status: 204,
      });
    }
    calls += 1;
    return calls === 1
      ? route.fulfill({
          headers: { "access-control-allow-origin": "*" },
          json: { error: "Generation failed; try again" },
          status: 503,
        })
      : route.fulfill({
          body: FULL,
          headers: { "access-control-allow-origin": "*", "content-type": "text/event-stream" },
        });
  });
  await page.goto(LESSON_URL);
  // Next.js adds its own route announcer as an alert, so the lesson's is picked by its text.
  const alert = page.getByRole("alert").filter({ hasText: "Generation failed" });
  await expect(alert).toContainText("Generation failed; try again");
  await expectNoAxeViolations(page);
  await alert.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("status")).toHaveText("Lesson ready.");
  await expect(alert).toHaveCount(0);
});

test("depth and age band request the matching lesson and last for the session", async ({
  page,
}) => {
  const requests: { readingLevel: string; audience: string }[] = [];
  await page.route("**/lessons", async (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "content-type",
          "access-control-allow-methods": "GET, POST",
        },
        status: 204,
      });
    }
    requests.push(route.request().postDataJSON() as { readingLevel: string; audience: string });
    return route.fulfill({
      body: FULL,
      headers: { "access-control-allow-origin": "*", "content-type": "text/event-stream" },
    });
  });
  await page.goto(LESSON_URL);
  const settings = page.getByRole("form", { name: "Lesson settings" });
  await expect(settings.getByRole("radio", { name: /Explore/ })).toBeChecked();
  await expect(settings.getByLabel("Age band (optional)")).toHaveValue("none");

  await settings.getByRole("radio", { name: /Deeper/ }).check();
  await expect(page).toHaveURL(/depth=deeper/);
  await settings.getByLabel("Age band (optional)").selectOption("teen");
  await expect(page).toHaveURL(/age=teen/);
  await expect
    .poll(() => requests.at(-1))
    .toMatchObject({ readingLevel: "technical", audience: "teen" });
  expect(requests[0]).toMatchObject({ readingLevel: "plain", audience: "general" });

  // A link with no settings still gets the session's choice when a lesson is started again.
  const remembered = await page.evaluate(() => sessionStorage.getItem("sbi.lesson-prefs"));
  expect(JSON.parse(remembered ?? "{}")).toEqual({ depth: "deeper", age: "teen" });
  await expectNoAxeViolations(page);
});

test("rates the lesson and reports a problem tied to its version", async ({ page }) => {
  const sent: unknown[] = [];
  await mockLesson(page, FULL);
  await mockApi(page, "/lessons/feedback", (body) => {
    sent.push(body);
    return {
      json: {
        feedbackId: "0192f1a0-0000-7000-8000-00000000f001",
        receivedAt: "2026-10-30T12:00:00.000Z",
      },
    };
  });
  await page.goto(LESSON_URL);
  const rate = page.getByRole("form", { name: "Rate this lesson" });
  await expect(rate.getByRole("button", { name: "Send rating" })).toBeDisabled();
  await rate.getByRole("group", { name: "How helpful was it?" }).getByLabel("4 Mostly").check();
  await rate.getByRole("group", { name: "How clear was it?" }).getByLabel("2 A little").check();
  await rate.getByRole("button", { name: "Send rating" }).click();
  await expect(page.getByText("Thanks for rating this lesson.")).toBeVisible();

  const report = page.getByRole("form", { name: "Report a problem" });
  await report.getByRole("button", { name: "Send report" }).click();
  await expect(report.getByRole("alert")).toHaveText("Choose what kind of problem it is.");
  await report.getByLabel("What is wrong?").selectOption("wrong-fact");
  await report.getByLabel("Details (optional)").fill("The history part seems off.");
  await report.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Thanks. A reviewer will look at this lesson.")).toBeVisible();

  expect(sent).toEqual([
    { lessonId: SAMPLE_LESSON.lessonId, version: 1, rating: { helpful: 4, clear: 2 } },
    {
      lessonId: SAMPLE_LESSON.lessonId,
      version: 1,
      report: { category: "wrong-fact", details: "The history part seems off." },
    },
  ]);
  await expectNoAxeViolations(page);
});

test("names the object, its assumptions and objectives, and says when a lesson is reused", async ({
  page,
}) => {
  const requests: { fresh?: boolean; question: string }[] = [];
  const cached = sseFrames([
    { type: "quick-answer", data: { ...SAMPLE_ANSWER, kind: "cached" } },
    { type: "lesson", data: SAMPLE_LESSON },
    { type: "sources", data: SAMPLE_SOURCES },
    { type: "visuals", data: { lessonId: SAMPLE_LESSON.lessonId, visuals: [] } },
  ]);
  await page.route("**/lessons", async (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "content-type",
          "access-control-allow-methods": "GET, POST",
        },
        status: 204,
      });
    }
    requests.push(route.request().postDataJSON() as { fresh?: boolean; question: string });
    return route.fulfill({
      body: cached,
      headers: { "access-control-allow-origin": "*", "content-type": "text/event-stream" },
    });
  });
  await page.goto(LESSON_URL);
  const seeing = page.getByRole("region", { name: "Small print looks larger" });
  await expect(seeing).toContainText("Object: Magnifying glass");
  await expect(seeing).toContainText(SAMPLE_LESSON.assumptions[0] ?? "");
  await expect(page.getByRole("region", { name: "In this lesson" })).toContainText(
    SAMPLE_LESSON.learningObjectives[0] ?? "",
  );
  const answer = page.getByRole("region", { name: "Quick answer" });
  await expect(answer).toContainText("written earlier for a similar question, on 30 October 2026");
  await expectNoAxeViolations(page);

  await answer.getByRole("button", { name: "Get a fresh answer" }).click();
  await expect(page).toHaveURL(/fresh=1/);
  await expect.poll(() => requests.at(-1)?.fresh).toBe(true);

  const ask = page.getByRole("form", { name: "Ask your own question" });
  await ask.getByRole("button", { name: "Ask" }).click();
  await expect(ask.getByRole("alert")).toHaveText("Write a question of at least 3 characters.");
  await ask
    .getByLabel("Ask your own question about the magnifying glass")
    .fill("Can it start a fire?");
  await ask.getByRole("button", { name: "Ask" }).click();
  await expect(page).toHaveURL(/q=Can\+it\+start\+a\+fire/);
  await expect.poll(() => requests.at(-1)?.question).toBe("Can it start a fire?");
});

test("asks for an object when the link names none", async ({ page }) => {
  await page.goto("/lesson");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Choose an object first");
  await expect(
    page.getByRole("link", { name: "Photograph or describe an object" }),
  ).toHaveAttribute("href", "/capture");
});
