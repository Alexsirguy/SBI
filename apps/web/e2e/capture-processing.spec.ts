import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

// Draws a photo in the page and selects it, since the repo keeps no binary fixtures.
async function selectGeneratedPhoto(page: Page, width: number, height: number) {
  await page.evaluate(
    ([w, h]) =>
      new Promise<void>((resolve, reject) => {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("no 2d context"));
          return;
        }
        for (let y = 0; y < h; y += 20) {
          for (let x = 0; x < w; x += 20) {
            context.fillStyle = (x + y) % 40 === 0 ? "#111111" : "#eeeeee";
            context.fillRect(x, y, 20, 20);
          }
        }
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("no blob"));
            return;
          }
          const transfer = new DataTransfer();
          transfer.items.add(new File([blob], "photo.png", { type: "image/png" }));
          const input = document.querySelector('input[name="upload"]') as HTMLInputElement;
          input.files = transfer.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
          resolve();
        }, "image/png");
      }),
    [width, height] as [number, number],
  );
}

async function setCrop(page: Page, values: Record<string, string>) {
  for (const [name, value] of Object.entries(values)) {
    await page.getByLabel(name, { exact: true }).fill(value);
  }
}

test("large photo is normalised down to the dimension cap as JPEG", async ({ page }) => {
  await page.goto("/capture");
  await selectGeneratedPhoto(page, 2000, 1000);

  await expect(page.getByRole("form", { name: "Photo capture" }).getByRole("status")).toContainText(
    "Ready: 1600 by 800 pixels, image/jpeg",
    { timeout: 15000 },
  );
  await expect(page.getByAltText("Preview of the photo to upload")).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeEnabled();
});

test("crop and retake flow updates and resets the prepared photo", async ({ page }) => {
  await page.goto("/capture");
  await selectGeneratedPhoto(page, 800, 600);
  const status = page.getByRole("form", { name: "Photo capture" }).getByRole("status");
  await expect(status).toContainText("Ready: 800 by 600 pixels", { timeout: 15000 });

  await setCrop(page, { height: "300", width: "400", x: "100", y: "50" });
  await page.getByRole("button", { name: "Apply crop" }).click();
  await expect(status).toContainText("Ready: 400 by 300 pixels", { timeout: 15000 });

  await page.getByRole("button", { name: "Retake or choose another" }).click();
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeDisabled();
  await expect(page.getByAltText("Preview of the photo to upload")).toHaveCount(0);
});

test("invalid crop values explain the problem instead of failing silently", async ({ page }) => {
  await page.goto("/capture");
  await selectGeneratedPhoto(page, 800, 600);
  const status = page.getByRole("form", { name: "Photo capture" }).getByRole("status");
  await expect(status).toContainText("Ready: 800 by 600 pixels", { timeout: 15000 });

  await setCrop(page, { height: "0", width: "0", x: "0", y: "0" });
  await page.getByRole("button", { name: "Apply crop" }).click();
  await expect(status).toContainText("positive width and height");
});

test("prepared capture page has no detectable accessibility violations", async ({ page }) => {
  await page.goto("/capture");
  await selectGeneratedPhoto(page, 800, 600);
  await expect(page.getByRole("form", { name: "Photo capture" }).getByRole("status")).toContainText(
    "Ready: 800 by 600 pixels",
    { timeout: 15000 },
  );

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
