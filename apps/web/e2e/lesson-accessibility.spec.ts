import { expect, test } from "@playwright/test";
import {
  SAMPLE_ANSWER,
  SAMPLE_LESSON,
  SAMPLE_SOURCES,
  sseFrames,
} from "../app/lesson/sample-lesson";
import { expectNoAxeViolations, expectVisibleFocus, tabTo } from "./a11y";
import { mockApi, mockLesson } from "./mock-api";

const LESSON_URL = "/lesson?taxonomyId=object.magnifying-glass&label=Magnifying+glass";

const FULL = sseFrames([
  { type: "quick-answer", data: SAMPLE_ANSWER },
  { type: "lesson", data: SAMPLE_LESSON },
  { type: "sources", data: SAMPLE_SOURCES },
  { type: "visuals", data: { lessonId: SAMPLE_LESSON.lessonId, visuals: [] } },
]);

test.beforeEach(async ({ page }) => {
  await mockLesson(page, FULL);
  await mockApi(page, "/lessons/feedback", () => ({
    json: {
      feedbackId: "0192f1a0-0000-7000-8000-00000000f001",
      receivedAt: "2026-10-30T12:00:00.000Z",
    },
  }));
});

test("the whole lesson can be read and used from the keyboard alone", async ({ page }) => {
  await page.goto(LESSON_URL);
  await expect(page.getByRole("status").first()).toHaveText("Lesson ready.");

  // "Show me why" opens the next step and moves the reader to it; the rest open in one go.
  await tabTo(page, page.getByRole("button", { name: "Show me why" }));
  await page.keyboard.press("Enter");
  await expect(
    page.locator(".rail").getByRole("heading", { name: "Glass bends light" }),
  ).toBeFocused();
  await tabTo(page, page.getByRole("button", { name: "Show the whole lesson" }));
  await page.keyboard.press("Enter");

  // Check your thinking: type, submit with Enter on the button, and focus moves to the explanation.
  const check = page.getByRole("region", { name: "Does the word grow?" });
  await tabTo(page, check.getByLabel("Your thinking (optional, not saved or marked)"));
  await page.keyboard.type("It only looks bigger.");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(check.locator(".check-feedback")).toBeFocused();

  // A marker in the evidence at the end leads to the source it names.
  const marker = page
    .getByRole("region", { name: "How do we know?" })
    .getByRole("link", { name: "Source 1: 2.8: The Simple Magnifier" })
    .first();
  await tabTo(page, marker);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#source-1$/);

  // Ratings use arrow keys inside each group, as radio groups should.
  const rate = page.getByRole("form", { name: "Rate this lesson" });
  await tabTo(
    page,
    rate.getByRole("group", { name: "How helpful was it?" }).getByLabel("1 Not at all"),
  );
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(rate.getByLabel("3 Somewhat").first()).toBeChecked();
  await page.keyboard.press("Tab");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Thanks for rating this lesson.")).toBeVisible();
});

test("changing depth or age keeps focus on the control while the new lesson loads", async ({
  page,
}) => {
  await page.goto(LESSON_URL);
  await expect(page.getByRole("status").first()).toHaveText("Lesson ready.");
  await page.getByRole("radio", { name: /Explore/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/depth=deeper/);
  await expect(page.getByRole("status").first()).toHaveText("Lesson ready.");
  await expect(page.getByRole("radio", { name: /Deeper/ })).toBeFocused();
  await expect(page.getByRole("radio", { name: /Deeper/ })).toBeChecked();

  await page.getByText("Age band", { exact: true }).click();
  const age = page.getByLabel("Age band (optional)");
  await age.focus();
  await age.selectOption("teen");
  await expect(page).toHaveURL(/age=teen/);
  await expect(age).toBeFocused();
});

test("feedback moves focus to its confirmation, and to the field a report is missing", async ({
  page,
}) => {
  await page.goto(LESSON_URL);
  await page.getByRole("button", { name: "Show the whole lesson" }).click();
  const rate = page.getByRole("form", { name: "Rate this lesson" });
  await rate.getByRole("group", { name: "How helpful was it?" }).getByLabel("5 Very").check();
  await rate.getByRole("group", { name: "How clear was it?" }).getByLabel("5 Very").check();
  await rate.getByRole("button", { name: "Send rating" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Thanks for rating this lesson.")).toBeFocused();

  const report = page.getByRole("form", { name: "Report a problem" });
  await report.getByRole("button", { name: "Send report" }).focus();
  await page.keyboard.press("Enter");
  await expect(report.getByLabel("What is wrong?")).toBeFocused();
  await report.getByLabel("What is wrong?").selectOption("unclear");
  await report.getByRole("button", { name: "Send report" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Thanks. A reviewer will look at this lesson.")).toBeFocused();
});

test("every reader control shows a clear focus outline", async ({ page }) => {
  await page.goto(LESSON_URL);
  await expect(page.getByRole("status").first()).toHaveText("Lesson ready.");
  await page.getByText("Age band", { exact: true }).click();
  await page.getByRole("button", { name: "Show the whole lesson" }).click();
  for (const target of [
    page.getByRole("radio", { name: /Explore/ }),
    page.getByLabel("Age band (optional)"),
    page.getByRole("link", { name: /^Source 1/ }).first(),
    page.getByLabel("Your thinking (optional, not saved or marked)"),
    page.getByRole("button", { name: "Compare with the explanation" }),
    page.getByLabel("What is wrong?"),
  ]) {
    await tabTo(page, target, 80);
    await expectVisibleFocus(target);
  }
});

test("meaning never rests on colour alone", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto(LESSON_URL);
  await expect(page.getByRole("status").first()).toHaveText("Lesson ready.");
  await page.getByRole("button", { name: "Show the whole lesson" }).click();
  // Each distinction the styling makes is also written out in words.
  await expect(page.getByRole("region", { name: "Small print looks larger" })).toContainText(
    "What you can observe",
  );
  await expect(page.getByRole("region", { name: "Glass bends light" })).toContainText(
    "Explanation",
  );
  await expect(page.getByRole("region", { name: "How do we know?" })).toContainText(
    "Based on limited evidence:",
  );
  await expect(page.getByRole("complementary", { name: "Before you read" })).toContainText("Note");
  await expectNoAxeViolations(page);
});

test("landmarks and headings give screen readers the lesson's outline", async ({ page }) => {
  await page.goto(LESSON_URL);
  await expect(page.getByRole("status").first()).toHaveText("Lesson ready.");
  await page.getByRole("button", { name: "Show the whole lesson" }).click();
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("list", { name: /Lesson, 8 of 8 steps open/ })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Before you read" })).toBeVisible();
  // Every module is its own named region, so a screen reader can jump between them.
  for (const section of SAMPLE_LESSON.sections) {
    await expect(page.getByRole("region", { name: section.heading ?? "" })).toHaveCount(1);
  }
  // Citation markers are announced by source, not as bare bracketed numbers.
  await expect(page.getByRole("link", { name: "[1]" })).toHaveCount(0);
});

test("while writing, the loader is announced and passes accessibility checks", async ({ page }) => {
  await page.unroute("**/lessons");
  await mockLesson(page, null);
  await page.goto(LESSON_URL);
  await expect(page.getByRole("heading", { name: "Writing your lesson…" })).toBeVisible();
  await expect(page.getByRole("status").first()).toHaveText("Starting your lesson…");
  await expectNoAxeViolations(page);
});
