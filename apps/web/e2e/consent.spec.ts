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

  await choices.getByRole("button", { name: "Stop keeping photos and delete them" }).click();
  await expect(choices).toContainText("Off. Photos are deleted about an hour after");
});
