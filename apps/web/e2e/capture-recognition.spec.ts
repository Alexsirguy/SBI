import { expect, type Page, test } from "@playwright/test";
import { expectNoAxeViolations } from "./a11y";
import {
  expectLessonOpened,
  lessonRequests,
  mockLesson,
  mockQuestions,
  mockRecognition,
  mockUploads,
  PHOTO_KEY,
  RECOGNITION_OFF,
  SESSION_ID,
  pressDone,
  suggestedQuestions,
} from "./mock-api";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function uploadPhoto(page: Page) {
  await page.goto("/capture");
  await page
    .locator('input[name="upload"]')
    .setInputFiles({ buffer: tinyPng, mimeType: "image/png", name: "object.png" });

  await pressDone(page);
  await page.getByRole("button", { name: "Upload photo" }).click({ timeout: 15000 });
  return page.locator(".photo-choices");
}

test.beforeEach(async ({ page }) => {
  await mockUploads(page);
});

const KETTLE_LIKE = [
  { label: "Stovetop kettle", certainty: "possible" },
  { label: "Teapot", certainty: "possible" },
  { label: "Coffee pot", certainty: "unsure" },
];

test("recognition offers three options in the model's words, and a pick asks what to learn", async ({
  page,
}) => {
  const sent = lessonRequests(page);
  await mockRecognition(page, { candidates: [], options: KETTLE_LIKE, next: { kind: "describe" } });
  const choices = await uploadPhoto(page);

  await expect(choices.getByRole("heading", { name: "Which one is it?" })).toBeFocused();
  await expect(choices.getByRole("listitem")).toHaveText([
    "Stovetop kettlepossible",
    "Teapotpossible",
    "Coffee potless likely",
  ]);
  await expect(page.getByAltText("Your photo")).toBeVisible();
  await expectNoAxeViolations(page);

  await choices.getByRole("button", { name: /^Stovetop kettle/ }).click();
  const step = page.locator(".photo-questions");
  await expect(
    step.getByRole("heading", { name: "What would you like to know about the stovetop kettle?" }),
  ).toBeFocused();
  await expect(
    step.getByRole("list", { name: "Questions you could ask" }).getByRole("button"),
  ).toHaveText(suggestedQuestions("stovetop kettle"));
  await expect(step.getByLabel("Or ask your own question")).toBeVisible();
  expect(sent).toEqual([]);
  await expectNoAxeViolations(page);

  await step.getByRole("button", { name: "Why does the stovetop kettle whistle?" }).click();
  await expectLessonOpened(page, "Stovetop kettle");
  await expect
    .poll(() => sent.at(0))
    .toMatchObject({
      subject: "Stovetop kettle",
      question: "Why does the stovetop kettle whistle?",
    });
});

test("the learner can ask their own question about the object instead", async ({ page }) => {
  const sent = lessonRequests(page);
  await mockRecognition(page, { candidates: [], options: KETTLE_LIKE, next: { kind: "describe" } });
  const choices = await uploadPhoto(page);
  await choices.getByRole("button", { name: /^Teapot/ }).click();

  const step = page.locator(".photo-questions");
  await step.getByLabel("Or ask your own question").fill("Why do teapots drip?");
  await step.getByRole("button", { name: "Ask" }).click();
  await expectLessonOpened(page, "Teapot");
  await expect
    .poll(() => sent.at(0))
    .toMatchObject({ subject: "Teapot", question: "Why do teapots drip?" });
});

test("the learner can go back and choose another object", async ({ page }) => {
  await mockRecognition(page, { candidates: [], options: KETTLE_LIKE, next: { kind: "describe" } });
  const choices = await uploadPhoto(page);
  await choices.getByRole("button", { name: /^Teapot/ }).click();
  await page.getByRole("button", { name: "Not a teapot? Choose again" }).click();
  await expect(page.getByRole("heading", { name: "Which one is it?" })).toBeFocused();
});

test("fixed questions stand in when suggestions fail", async ({ page }) => {
  await mockQuestions(page, 500);
  await mockRecognition(page, { candidates: [], options: KETTLE_LIKE, next: { kind: "describe" } });
  const choices = await uploadPhoto(page);
  await choices.getByRole("button", { name: /^Teapot/ }).click();
  await expect(
    page.getByRole("list", { name: "Questions you could ask" }).getByRole("button"),
  ).toHaveCount(5);
  await expect(
    page.getByRole("button", { name: "What is the science behind the teapot?" }),
  ).toBeVisible();
});

test("the photo shows on its own lesson, and not on the next object the learner types", async ({
  page,
}) => {
  await mockLesson(page, null);
  await mockRecognition(page, { candidates: [], options: KETTLE_LIKE, next: { kind: "describe" } });
  const choices = await uploadPhoto(page);
  await choices.getByRole("button", { name: /^Stovetop kettle/ }).click();
  await page.getByRole("button", { name: "Why does the stovetop kettle whistle?" }).click();
  await expectLessonOpened(page, "Stovetop kettle");
  await expect(page.getByAltText("Your photo")).toBeVisible();

  await page.getByRole("link", { name: /Describe it instead/ }).click();
  await page.getByLabel("What is it?").fill("rainbow");
  await page.getByRole("button", { name: "Start lesson" }).click();
  await expectLessonOpened(page, "Rainbow");
  await expect(page.locator(".scanner")).toContainText("Rainbow");
  await expect(page.getByAltText("Your photo")).toHaveCount(0);
});

test("the learner can say what it is instead of picking", async ({ page }) => {
  await mockRecognition(page, { candidates: [], options: KETTLE_LIKE, next: { kind: "describe" } });
  const choices = await uploadPhoto(page);

  await choices.getByLabel("Something else? Tell us what it is").fill("camping kettle");
  await choices.getByRole("button", { name: "Use this" }).click();
  await page.getByRole("button", { name: "Why does the camping kettle whistle?" }).click();
  await expectLessonOpened(page, "Camping kettle");
});

test("trying a different photo goes back to the photo choice", async ({ page }) => {
  await mockRecognition(page, { candidates: [], options: KETTLE_LIKE, next: { kind: "describe" } });
  const choices = await uploadPhoto(page);
  await choices.getByRole("button", { name: "Try a different photo" }).click();
  await expect(page.getByRole("button", { name: "Take a photo" })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Which one is it?" })).toHaveCount(0);
});

test("a photo the model cannot name asks the learner to say what it is", async ({ page }) => {
  await mockRecognition(page, { candidates: [], next: { kind: "describe" } });
  const photo = await uploadPhoto(page);

  await expect(photo.getByRole("status").first()).toContainText("We couldn't tell what this is.");
  await photo.getByLabel("Something else? Tell us what it is").fill("kite");
  await photo.getByRole("button", { name: "Use this" }).click();
  await page.getByRole("button", { name: "Why does the kite whistle?" }).click();
  await expectLessonOpened(page, "Kite");
});

test("when recognition is down, the photo step says so and offers describing", async ({ page }) => {
  const photo = await uploadPhoto(page);
  await expect(photo.getByRole("status").first()).toHaveText(RECOGNITION_OFF);
  await expect(photo.getByLabel("Something else? Tell us what it is")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("a retake reuses the session so results stay grouped", async ({ page }) => {
  const recognition = await mockRecognition(page, { candidates: [], next: { kind: "describe" } });
  await uploadPhoto(page);
  await expect(page.getByLabel("Something else? Tell us what it is")).toBeVisible();

  await page.getByRole("button", { name: "Try a different photo" }).click();
  await page
    .locator('input[name="upload"]')
    .setInputFiles({ buffer: tinyPng, mimeType: "image/png", name: "again.png" });

  await pressDone(page);
  await page.getByRole("button", { name: "Upload photo" }).click({ timeout: 15000 });

  await expect
    .poll(() => recognition.requests)
    .toEqual([{ key: PHOTO_KEY }, { key: PHOTO_KEY, sessionId: SESSION_ID }]);
});
