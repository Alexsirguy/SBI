import { expect, test } from "@playwright/test";
import { SAMPLE_ANSWER, SAMPLE_LESSON, sseFrames } from "../app/lesson/sample-lesson";
import { expectNoAxeViolations } from "./a11y";
import { mockLesson } from "./mock-api";

const LESSON_URL = "/lesson?taxonomyId=object.magnifying-glass&label=Magnifying+glass";

const FULL = sseFrames([
  { type: "progress", data: { stage: "researching", message: "Researching 3 questions." } },
  { type: "quick-answer", data: SAMPLE_ANSWER },
  { type: "lesson", data: SAMPLE_LESSON },
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
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Quick answer", ...headings]);

  const nav = page.getByRole("navigation", { name: "Lesson sections" });
  await nav.getByRole("link", { name: "Reading stones" }).click();
  await expect(page).toHaveURL(/#section-history$/);
  await expect(page.locator(".lesson-sections")).toHaveAttribute("aria-busy", "false");
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

test("asks for an object when the link names none", async ({ page }) => {
  await page.goto("/lesson");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Choose an object first");
  await expect(
    page.getByRole("link", { name: "Photograph or describe an object" }),
  ).toHaveAttribute("href", "/capture");
});
