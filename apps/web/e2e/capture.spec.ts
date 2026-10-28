import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// 1x1 transparent PNG; content is irrelevant, only name/size/type are validated.
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("capture page offers camera and upload entries with limits and privacy cue", async ({
  page,
}) => {
  await page.goto("/capture");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Photograph an object");
  await expect(page.getByText("Accepted formats: JPG, PNG, HEIC.")).toBeVisible();
  await expect(page.getByText("Maximum size: 10 MB.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "How your photo is handled" })).toBeVisible();
  await expect(page.getByText("stored privately")).toBeVisible();

  const camera = page.locator('input[name="camera"]');
  await expect(camera).toHaveAttribute("accept", "image/*");
  await expect(camera).toHaveAttribute("capture", "environment");
  await expect(page.locator('input[name="upload"]')).toHaveAttribute(
    "accept",
    ".jpg,.jpeg,.png,.heic",
  );
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeDisabled();
});

test("capture page validates the selected photo", async ({ page }) => {
  await page.goto("/capture");
  const upload = page.locator('input[name="upload"]');
  const status = page.getByRole("status");

  await upload.setInputFiles({ buffer: tinyPng, mimeType: "image/png", name: "object.png" });
  await expect(status).toContainText("Selected object.png");
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeEnabled();

  await upload.setInputFiles({ buffer: tinyPng, mimeType: "text/plain", name: "notes.txt" });
  await expect(status).toContainText("is not a photo");
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeDisabled();

  await upload.setInputFiles({
    buffer: Buffer.alloc(11 * 1024 * 1024),
    mimeType: "image/jpeg",
    name: "huge.jpg",
  });
  await expect(status).toContainText("is too large");
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeDisabled();
});

test("capture page has no detectable accessibility violations", async ({ page }) => {
  await page.goto("/capture");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
