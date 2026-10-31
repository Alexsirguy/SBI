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

test("a large photo is normalised to the size cap as JPEG, without showing the numbers", async ({
  page,
}) => {
  await page.goto("/capture");
  await selectGeneratedPhoto(page, 2000, 1000);

  const preview = page.getByAltText("Your photo");
  await expect(preview).toHaveAttribute("data-width", "1600", { timeout: 15000 });
  await expect(preview).toHaveAttribute("data-height", "800");
  await expect(preview).toHaveAttribute("data-type", "image/jpeg");
  await expect(page.getByText(/1600 by 800|pixels/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeEnabled();
});

test("EXIF orientation is applied so sideways photos come out upright", async ({ page }) => {
  await page.goto("/capture");
  await selectRotatedJpeg(page, 400, 200);

  const preview = page.getByAltText("Your photo");
  await expect(preview).toHaveAttribute("data-width", "200", { timeout: 15000 });
  await expect(preview).toHaveAttribute("data-height", "400");
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
  const preview = page.getByAltText("Your photo");
  await expect(preview).toBeVisible({ timeout: 15000 });
  expect(Number(await preview.getAttribute("data-bytes"))).toBeLessThan(originalBytes);
});

test("choosing another photo goes back to the photo choice", async ({ page }) => {
  await page.goto("/capture");
  await selectGeneratedPhoto(page, 800, 600);
  await expect(page.getByAltText("Your photo")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Choose another photo" }).click();
  await expect(page.getByAltText("Your photo")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Take a photo" })).toBeFocused();
});

test("prepared capture page has no detectable accessibility violations", async ({ page }) => {
  await page.goto("/capture");
  await selectGeneratedPhoto(page, 800, 600);
  await expect(page.getByAltText("Your photo")).toBeVisible({ timeout: 15000 });
  await expectNoAxeViolations(page);
});
