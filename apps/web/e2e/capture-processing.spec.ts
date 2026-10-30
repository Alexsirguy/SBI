import { expectNoAxeViolations } from "./a11y";
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

const CROP_LABELS = { height: "Height (px)", width: "Width (px)", x: "Left (px)", y: "Top (px)" };

async function setCrop(page: Page, values: Partial<Record<keyof typeof CROP_LABELS, string>>) {
  for (const [name, value] of Object.entries(values)) {
    await page
      .getByLabel(CROP_LABELS[name as keyof typeof CROP_LABELS], { exact: true })
      .fill(value);
  }
}

// Builds a JPEG whose pixels are landscape but whose EXIF says "rotate 90° clockwise".
async function selectRotatedJpeg(page: Page, width: number, height: number) {
  await page.evaluate(
    ([w, h]) =>
      new Promise<void>((resolve, reject) => {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")?.fillRect(0, 0, w / 2, h);
        canvas.toBlob(async (blob) => {
          if (!blob) {
            reject(new Error("no blob"));
            return;
          }
          const jpeg = new Uint8Array(await blob.arrayBuffer());
          const tiff = [
            0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01, 0x01, 0x12, 0x00, 0x03,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          ];
          const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
          const length = payload.length + 2;
          const app1 = [0xff, 0xe1, length >> 8, length & 0xff, ...payload];
          const rotated = new Uint8Array([...jpeg.slice(0, 2), ...app1, ...jpeg.slice(2)]);
          const transfer = new DataTransfer();
          transfer.items.add(new File([rotated], "rotated.jpg", { type: "image/jpeg" }));
          const input = document.querySelector('input[name="upload"]') as HTMLInputElement;
          input.files = transfer.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
          resolve();
        }, "image/jpeg");
      }),
    [width, height] as [number, number],
  );
}

test("large photo is normalised down to the dimension cap as JPEG", async ({ page }) => {
  await page.goto("/capture");
  await selectGeneratedPhoto(page, 2000, 1000);

  await expect(page.getByRole("form", { name: "Photo capture" }).getByRole("status")).toContainText(
    "Ready: 1600 by 800 pixels, JPEG",
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
  await expect(page.getByRole("button", { name: "Take a photo" })).toBeFocused();
});

test("repeated crops start from the original rather than the previous crop", async ({ page }) => {
  await page.goto("/capture");
  await selectGeneratedPhoto(page, 800, 600);
  const status = page.getByRole("form", { name: "Photo capture" }).getByRole("status");
  await expect(status).toContainText("Ready: 800 by 600 pixels", { timeout: 15000 });

  await setCrop(page, { height: "100", width: "100" });
  await page.getByRole("button", { name: "Apply crop" }).click();
  await expect(status).toContainText("Ready: 100 by 100 pixels", { timeout: 15000 });
  await setCrop(page, { height: "600", width: "800" });
  await page.getByRole("button", { name: "Apply crop" }).click();
  await expect(status).toContainText("Ready: 800 by 600 pixels", { timeout: 15000 });
});

test("crop area can be moved and resized with the keyboard", async ({ page }) => {
  await page.goto("/capture");
  await selectGeneratedPhoto(page, 800, 600);
  const status = page.getByRole("form", { name: "Photo capture" }).getByRole("status");
  await expect(status).toContainText("Ready: 800 by 600 pixels", { timeout: 15000 });

  const area = page.getByRole("button", { name: /^Crop area/ });
  await area.focus();
  await page.keyboard.press("Shift+ArrowLeft");
  await page.keyboard.press("Shift+ArrowUp");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Width (px)")).toHaveValue("784");
  await expect(page.getByLabel("Height (px)")).toHaveValue("584");
  await expect(page.getByLabel("Left (px)")).toHaveValue("16");

  await page.keyboard.press("Tab");
  await page.getByRole("button", { name: "Apply crop" }).press("Enter");
  await expect(status).toContainText("Ready: 784 by 584 pixels", { timeout: 15000 });
});

test("EXIF orientation is applied so sideways photos come out upright", async ({ page }) => {
  await page.goto("/capture");
  await selectRotatedJpeg(page, 400, 200);

  await expect(page.getByRole("form", { name: "Photo capture" }).getByRole("status")).toContainText(
    "Ready: 200 by 400 pixels",
    { timeout: 15000 },
  );
});

test("normalisation compresses a large photo below its original size", async ({ page }) => {
  await page.goto("/capture");
  const originalBytes = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const canvas = document.createElement("canvas");
        canvas.width = 1600;
        canvas.height = 1200;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("no 2d context"));
          return;
        }
        const pixels = context.createImageData(1600, 1200);
        for (let i = 0; i < pixels.data.length; i += 1) {
          pixels.data[i] = Math.floor(Math.random() * 256);
        }
        context.putImageData(pixels, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("no blob"));
            return;
          }
          const transfer = new DataTransfer();
          transfer.items.add(new File([blob], "noisy.png", { type: "image/png" }));
          const input = document.querySelector('input[name="upload"]') as HTMLInputElement;
          input.files = transfer.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
          resolve(blob.size);
        }, "image/png");
      }),
  );
  const status = page.getByRole("form", { name: "Photo capture" }).getByRole("status");
  await expect(status).toContainText("Ready:", { timeout: 15000 });
  const match = /\(([\d.]+) (B|KB|MB)\)/.exec((await status.textContent()) ?? "");
  const factor = { B: 1, KB: 1024, MB: 1024 * 1024 }[match?.[2] as "B" | "KB" | "MB"];
  expect(Number(match?.[1]) * factor).toBeLessThan(originalBytes);
});

test("invalid crop values explain the problem instead of failing silently", async ({ page }) => {
  await page.goto("/capture");
  await selectGeneratedPhoto(page, 800, 600);
  const status = page.getByRole("form", { name: "Photo capture" }).getByRole("status");
  await expect(status).toContainText("Ready: 800 by 600 pixels", { timeout: 15000 });

  await setCrop(page, { height: "0", width: "0", x: "0", y: "0" });
  await page.getByRole("button", { name: "Apply crop" }).click();
  await expect(page.getByRole("form", { name: "Photo capture" }).getByRole("alert")).toContainText(
    "positive width and height",
  );
});

test("prepared capture page has no detectable accessibility violations", async ({ page }) => {
  await page.goto("/capture");
  await selectGeneratedPhoto(page, 800, 600);
  await expect(page.getByRole("form", { name: "Photo capture" }).getByRole("status")).toContainText(
    "Ready: 800 by 600 pixels",
    { timeout: 15000 },
  );

  await expectNoAxeViolations(page);
});

test("crop area can be resized by dragging its corner handle", async ({ page }) => {
  await page.goto("/capture");
  await selectGeneratedPhoto(page, 800, 600);
  const status = page.getByRole("form", { name: "Photo capture" }).getByRole("status");
  await expect(status).toContainText("Ready: 800 by 600 pixels", { timeout: 15000 });

  const cropArea = page.getByRole("button", { name: /^Crop area/ });
  // Mouse moves only reach what is on screen, so bring the preview into view as a learner would.
  await cropArea.scrollIntoViewIfNeeded();
  const box = await cropArea.boundingBox();
  if (!box) {
    throw new Error("crop area not rendered");
  }
  // The preview is 320px wide for an 800px image, so 40 screen pixels is 100 image pixels.
  await page.mouse.move(box.x + box.width - 2, box.y + box.height - 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 42, box.y + box.height - 42, { steps: 4 });
  await page.mouse.up();

  await expect(page.getByLabel("Width (px)")).toHaveValue("700");
  await expect(page.getByLabel("Height (px)")).toHaveValue("500");
});
