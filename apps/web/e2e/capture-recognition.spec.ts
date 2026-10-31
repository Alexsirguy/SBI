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
  return page.getByRole("region", { name: "What is in your photo?" });
}

test.beforeEach(async ({ page }) => {
  await mockUploads(page);
});

test("a recognised photo goes straight to a lesson on what the model named", async ({ page }) => {
  const sent = lessonRequests(page);
  // Not in the catalogue: the lesson starts anyway, with no search or pick step.
  await mockRecognition(page, {
    candidates: [],
    subject: "Camping kettle",
    next: { kind: "describe" },
  });
  await uploadPhoto(page);

  await expectLessonOpened(page, "Camping kettle");
  await expect.poll(() => sent.at(0)).toMatchObject({ subject: "Camping kettle" });
  expect(sent[0]).not.toHaveProperty("taxonomyId");
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "Not a camping kettle? Describe it instead" }).click();
  await expect(page).toHaveURL(/\/capture#text-entry$/);
});

test("a photo the model cannot name asks the learner to describe it", async ({ page }) => {
  await mockRecognition(page, { candidates: [], next: { kind: "describe" } });
  const photo = await uploadPhoto(page);

  await expect(photo.getByRole("status")).toHaveText(
    "We could not tell what is in the photo. Describe it to start your lesson.",
  );
  await photo.getByLabel("What is it?").fill("kite");
  await photo.getByRole("button", { name: "Start lesson" }).click();
  await expectLessonOpened(page, "Kite");
});

test("when recognition is down, the photo step says so and offers describing", async ({ page }) => {
  const photo = await uploadPhoto(page);
  await expect(photo.getByRole("status")).toHaveText(RECOGNITION_OFF);
  await expect(photo.getByLabel("What is it?")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("a retake reuses the session so results stay grouped", async ({ page }) => {
  const recognition = await mockRecognition(page, { candidates: [], next: { kind: "describe" } });
  await uploadPhoto(page);
  await expect(page.getByLabel("What is it?")).toBeVisible();

  await page.getByRole("button", { name: "Retake or choose another" }).click();
  await page
    .locator('input[name="upload"]')
    .setInputFiles({ buffer: tinyPng, mimeType: "image/png", name: "again.png" });
  await page.getByRole("button", { name: "Upload photo" }).click({ timeout: 15000 });

  await expect
    .poll(() => recognition.requests)
    .toEqual([{ key: PHOTO_KEY }, { key: PHOTO_KEY, sessionId: SESSION_ID }]);
});
