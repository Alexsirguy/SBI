import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./a11y";
import { mockApi, mockRecognition, mockUploads, PHOTO_KEY, pressDone } from "./mock-api";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("a photo is kept only after the learner agrees, and can be deleted later", async ({
  page,
}) => {
  await mockUploads(page);
  await mockRecognition(page, {
    candidates: [],
    options: [{ label: "Bicycle", certainty: "likely" }],
    next: { kind: "describe" },
  });
  const kept: unknown[] = [];
  const deleted: unknown[] = [];
  await mockApi(page, "/photos/keep", (body) => {
    kept.push(body);
    return { json: { kept: true } };
  });
  await mockApi(page, "/photos/delete", (body) => {
    deleted.push(body);
    return { json: { deleted: true } };
  });

  await page.goto("/capture");
  await page
    .locator('input[name="upload"]')
    .setInputFiles({ buffer: tinyPng, mimeType: "image/png", name: "object.png" });
  await pressDone(page);
  await page.getByRole("button", { name: "Upload photo" }).click({ timeout: 15000 });

  await page.getByRole("button", { name: "Keep this photo" }).click();
  const asking = page.getByRole("region", { name: "Keep this photo?" });
  await expect(asking).toContainText("never used to train AI");
  await expectNoAxeViolations(page);
  expect(kept).toEqual([]);

  await asking.getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Photo kept" })).toBeVisible();
  expect(kept).toEqual([{ key: PHOTO_KEY, consentVersion: "consent-1" }]);

  await page.getByRole("link", { name: "your privacy choices" }).click();
  const choices = page.getByRole("region", { name: "Your choices" });
  await expect(choices).toContainText("Bicycle, kept");
  await expectNoAxeViolations(page);

  await choices.getByRole("button", { name: "Delete Bicycle" }).click();
  await expect(choices.getByRole("status")).toHaveText("Deleted.");
  await expect(choices).not.toContainText("Bicycle, kept");
  expect(deleted).toEqual([{ key: PHOTO_KEY }]);

  const keeping = choices.getByRole("group", { name: "Keep photos I choose to keep" });
  await expect(keeping.getByRole("button", { name: "Accept" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await keeping.getByRole("button", { name: "Decline" }).click();
  await expect(keeping.getByRole("button", { name: "Decline" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("a learner who already accepted keeps a photo in one press", async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem(
      "sbi.consent",
      JSON.stringify({
        version: "consent-1",
        choices: { "save-photos": true },
        decidedAt: "2026-11-03T10:00:00.000Z",
      }),
    ),
  );
  await mockUploads(page);
  await mockRecognition(page, {
    candidates: [],
    options: [{ label: "Bicycle", certainty: "likely" }],
    next: { kind: "describe" },
  });
  const kept: unknown[] = [];
  await mockApi(page, "/photos/keep", (body) => {
    kept.push(body);
    return { json: { kept: true } };
  });

  await page.goto("/capture");
  await page
    .locator('input[name="upload"]')
    .setInputFiles({ buffer: tinyPng, mimeType: "image/png", name: "object.png" });
  await pressDone(page);
  await page.getByRole("button", { name: "Upload photo" }).click({ timeout: 15000 });
  await page.getByRole("button", { name: "Keep this photo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Photo kept" })).toBeVisible();
  expect(kept).toEqual([{ key: PHOTO_KEY, consentVersion: "consent-1" }]);
});
