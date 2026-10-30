import { expectNoAxeViolations } from "./a11y";
import { mockApi, mockUploads, PHOTO_KEY } from "./mock-api";
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
  const privacy = page.getByRole("region", { name: "How your photo is handled" });
  await expect(privacy).toContainText("only to recognise the object");
  await expect(privacy).toContainText("deleted within 7 days");
  await expect(privacy).toContainText("Cloudflare R2");
  await expect(privacy).toContainText("Meta");
  await expect(privacy).toContainText("OpenAI");
  await expect(privacy).toContainText("neither may train on it");

  const camera = page.locator('input[name="camera"]');
  await expect(camera).toHaveAttribute("accept", "image/*");
  await expect(camera).toHaveAttribute("capture", "environment");
  await expect(page.locator('input[name="upload"]')).toHaveAttribute(
    "accept",
    ".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif",
  );
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeDisabled();
});

test("capture page validates the selected photo", async ({ page }) => {
  await page.goto("/capture");
  const upload = page.locator('input[name="upload"]');
  const form = page.getByRole("form", { name: "Photo capture" });
  const status = form.getByRole("status");
  const alert = form.getByRole("alert");

  await upload.setInputFiles({ buffer: tinyPng, mimeType: "image/png", name: "object.png" });
  await expect(status).toContainText("Ready: 1 by 1 pixels, JPEG", { timeout: 15000 });
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeEnabled();

  await upload.setInputFiles({ buffer: tinyPng, mimeType: "text/plain", name: "notes.txt" });
  await expect(alert).toContainText("is not a photo");
  await expect(upload).toHaveAttribute("aria-invalid", "true");
  await expect(upload).toHaveAccessibleDescription(/is not a photo/);
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeDisabled();

  await upload.setInputFiles({ buffer: Buffer.alloc(0), mimeType: "image/png", name: "empty.png" });
  await expect(alert).toContainText("is empty");

  await upload.setInputFiles({
    buffer: Buffer.alloc(11 * 1024 * 1024),
    mimeType: "image/jpeg",
    name: "huge.jpg",
  });
  await expect(alert).toContainText("is too large");
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeDisabled();
});

test("capture page has no detectable accessibility violations", async ({ page }) => {
  await page.goto("/capture");

  await expectNoAxeViolations(page);
});

test("upload reports honestly when private storage is unavailable", async ({ page }) => {
  await mockApi(page, "/uploads", () => ({
    json: { error: "Photo uploads are unavailable right now." },
    status: 503,
  }));
  await page.goto("/capture");
  await page
    .locator('input[name="upload"]')
    .setInputFiles({ buffer: tinyPng, mimeType: "image/png", name: "object.png" });
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeEnabled({ timeout: 15000 });
  await page.getByRole("button", { name: "Upload photo" }).click();

  await expect(page.getByRole("form", { name: "Photo capture" }).getByRole("alert")).toContainText(
    "unavailable",
    { timeout: 15000 },
  );
});

test("after upload the learner can choose to keep the photo", async ({ page }) => {
  const kept: unknown[] = [];
  await mockUploads(page);
  await mockApi(page, "/photos/keep", (body) => {
    kept.push(body);
    return { json: { kept: true } };
  });
  await page.goto("/capture");
  await page
    .locator('input[name="upload"]')
    .setInputFiles({ buffer: tinyPng, mimeType: "image/png", name: "object.png" });
  await page.getByRole("button", { name: "Upload photo" }).click({ timeout: 15000 });
  const status = page.getByRole("form", { name: "Photo capture" }).getByRole("status");
  await expect(status).toContainText("Uploaded, with location and camera details removed");

  await page.getByRole("button", { name: "Keep this photo" }).click();
  await expect(status).toContainText("will not be deleted automatically");
  expect(kept).toEqual([{ key: PHOTO_KEY }]);
  await expect(page.getByRole("button", { name: "Keep this photo" })).toHaveCount(0);
});
