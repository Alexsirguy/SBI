import { expect, test } from "@playwright/test";
import {
  SAMPLE_ANSWER,
  SAMPLE_LESSON,
  SAMPLE_SOURCES,
  sseFrames,
} from "../app/lesson/sample-lesson";
import { expectNoAxeViolations } from "./a11y";
import { mockApi, mockLesson, CREDENTIALED_CORS } from "./mock-api";

const LESSON_URL = "/lesson?taxonomyId=object.magnifying-glass&label=Magnifying+glass";

const FULL = sseFrames([
  { type: "progress", data: { stage: "researching", message: "Researching 3 questions." } },
  { type: "quick-answer", data: SAMPLE_ANSWER },
  { type: "lesson", data: SAMPLE_LESSON },
  { type: "sources", data: SAMPLE_SOURCES },
  { type: "visuals", data: { lessonId: SAMPLE_LESSON.lessonId, visuals: [] } },
]);

test("shows the prototype's writing loader until the quick answer arrives", async ({ page }) => {
  await mockLesson(page, null);
  await page.goto(LESSON_URL);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lesson: Magnifying glass");
  await expect(page.getByRole("status")).toHaveText("Starting your lesson…");
  await expect(page.getByRole("heading", { name: "Writing your lesson…" })).toBeVisible();
  await expect(page.locator(".scanner")).toContainText("Magnifying glass");
  await expect(page.getByRole("region", { name: "Quick answer" })).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test("shows the quick answer as soon as it is ready, while the rest is written", async ({
  page,
}) => {
  await mockLesson(
    page,
    sseFrames([
      { type: "progress", data: { stage: "drafting", message: "Writing the lesson." } },
      { type: "quick-answer", data: SAMPLE_ANSWER },
    ]),
  );
  await page.goto(LESSON_URL);
  await expect(page.getByRole("region", { name: "Quick answer" })).toContainText(
    SAMPLE_ANSWER.shortAnswer,
  );
  await expect(page.getByRole("heading", { name: "Writing your lesson…" })).toHaveCount(0);
});

test("reads like the prototype: one notice, then every step open on the rail", async ({ page }) => {
  await mockLesson(page, FULL);
  await page.goto(LESSON_URL);
  await expect(page.getByRole("status")).toHaveText("Lesson ready.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SAMPLE_LESSON.title);
  await expect(page.locator(".topic-chip")).toHaveText("Magnifying glass");

  // However many disclaimers the lesson carries, the learner sees one notice at the top.
  const notices = page.getByRole("complementary", { name: "Before you read" });
  await expect(notices).toHaveCount(1);
  await expect(notices.locator(".sbi-notice")).toHaveCount(1);
  await expect(notices).toContainText("general knowledge");
  // Several doubts read as one caution, never the same point repeated.
  await expect(notices.locator(".sbi-notice p")).toHaveCount(1);

  // The whole lesson is open: the learner only scrolls, with no buttons to reveal more.
  const [, second] = SAMPLE_LESSON.sections;
  const rail = page.locator(".rail");
  await expect(rail.getByRole("heading", { level: 2 })).toHaveText(
    SAMPLE_LESSON.sections.map((section) => section.heading ?? ""),
  );
  await expect(rail.locator("mark")).toContainText(second?.text ?? "");
  await expect(
    page.getByRole("button", { name: /Show me why|Show the whole lesson|^Next:/ }),
  ).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test("sources sit collapsed at the end, with no evidence list and nothing inside the steps", async ({
  page,
}) => {
  await mockLesson(page, FULL);
  await page.goto(LESSON_URL);
  await expect(page.locator(".rail .citation-marker")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "How do we know?" })).toHaveCount(0);

  await expect(page.locator(".lesson-body > section").last()).toHaveClass(/lesson-feedback/);
  const list = page.getByRole("region", { name: "Sources" });
  await expect(list.locator("details.lesson-fold")).not.toHaveAttribute("open");
  await expect(list.locator("summary").first()).toContainText("2 sources");
  await list.locator("summary").first().click();
  await expect(list.getByRole("listitem").first()).toContainText("CC BY 4.0");
  await expect(list).toContainText("Lesson written 30 October 2026");
  // Quoted passages stay behind their own toggle.
  const quotes = list.locator(".source-quotes").first();
  await expect(quotes).not.toHaveAttribute("open");
  await quotes.locator("summary").click();
  await expect(quotes.locator("blockquote").first()).toBeVisible();
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
          ...CREDENTIALED_CORS,
          "access-control-allow-headers": "content-type",
          "access-control-allow-methods": "GET, POST",
        },
        status: 204,
      });
    }
    calls += 1;
    return calls === 1
      ? route.fulfill({
          headers: CREDENTIALED_CORS,
          json: { error: "Generation failed; try again" },
          status: 503,
        })
      : route.fulfill({
          body: FULL,
          headers: { ...CREDENTIALED_CORS, "content-type": "text/event-stream" },
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
          ...CREDENTIALED_CORS,
          "access-control-allow-headers": "content-type",
          "access-control-allow-methods": "GET, POST",
        },
        status: 204,
      });
    }
    requests.push(route.request().postDataJSON() as { readingLevel: string; audience: string });
    return route.fulfill({
      body: FULL,
      headers: { ...CREDENTIALED_CORS, "content-type": "text/event-stream" },
    });
  });
  await page.goto(LESSON_URL);
  const settings = page.getByRole("form", { name: "Lesson settings" });
  await expect(settings.getByRole("radio", { name: /Explore/ })).toBeChecked();
  await settings.getByText("Age band", { exact: true }).click();
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

test("names the object and its assumptions, and says when a lesson is reused", async ({ page }) => {
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
          ...CREDENTIALED_CORS,
          "access-control-allow-headers": "content-type",
          "access-control-allow-methods": "GET, POST",
        },
        status: 204,
      });
    }
    requests.push(route.request().postDataJSON() as { fresh?: boolean; question: string });
    return route.fulfill({
      body: cached,
      headers: { ...CREDENTIALED_CORS, "content-type": "text/event-stream" },
    });
  });
  await page.goto(LESSON_URL);
  const seeing = page.getByRole("region", { name: "Small print looks larger" });
  await expect(seeing).toContainText("Object: Magnifying glass");
  await expect(seeing).toContainText(SAMPLE_LESSON.assumptions[0] ?? "");
  const provenance = page.locator(".provenance");
  await expect(provenance).toContainText(
    "written earlier for a similar question, on 30 October 2026",
  );
  await expectNoAxeViolations(page);

  await provenance.getByRole("button", { name: "Get a fresh answer" }).click();
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

test("asks for something to learn about when the link names nothing", async ({ page }) => {
  await page.goto("/lesson");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Choose something to learn about",
  );
  await expect(page.getByRole("link", { name: "Photograph or describe anything" })).toHaveAttribute(
    "href",
    "/capture",
  );
});
