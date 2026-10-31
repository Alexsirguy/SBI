import { expect, type Page, test } from "@playwright/test";
import { expectNoAxeViolations } from "./a11y";
import {
  expectLessonOpened,
  lessonRequests,
  mockRecognition,
  mockUploads,
  PHOTO_KEY,
  RECOGNITION_OFF,
  SESSION_ID,
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

test("recognition offers three options in the model's words, and a pick starts the lesson", async ({
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
  await expectLessonOpened(page, "Stovetop kettle");
  await expect.poll(() => sent.at(0)).toMatchObject({ subject: "Stovetop kettle" });
});

test("the learner can say what it is instead of picking", async ({ page }) => {
  await mockRecognition(page, { candidates: [], options: KETTLE_LIKE, next: { kind: "describe" } });
  const choices = await uploadPhoto(page);

  await choices.getByLabel("Something else? Tell us what it is").fill("camping kettle");
  await choices.getByRole("button", { name: "Use this" }).click();
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
  await page.getByRole("button", { name: "Upload photo" }).click({ timeout: 15000 });

  await expect
    .poll(() => recognition.requests)
    .toEqual([{ key: PHOTO_KEY }, { key: PHOTO_KEY, sessionId: SESSION_ID }]);
});
