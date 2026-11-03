import { expect, type Page, test } from "@playwright/test";
import { expectNoAxeViolations } from "./a11y";
import { pressDone } from "./mock-api";

// Draws a photo in the page: a dark square on a plain backdrop, or noise that fills the frame.
async function drawPhoto(page: Page, kind: "object" | "busy", size = { width: 800, height: 600 }) {
  await page.evaluate(
    ({ busy, width, height }) =>
      new Promise<void>((resolve) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (context && busy) {
          const pixels = context.createImageData(width, height);
          for (let i = 0; i < pixels.data.length; i += 1) {
            pixels.data[i] = i % 4 === 3 ? 255 : Math.floor(Math.random() * 256);
          }
          context.putImageData(pixels, 0, 0);
        } else if (context) {
          context.fillStyle = "#eeeeee";
          context.fillRect(0, 0, width, height);
          context.fillStyle = "#223344";
          context.fillRect(300, 200, 200, 200);
        }
        canvas.toBlob((blob) => {
          const transfer = new DataTransfer();
          if (blob) transfer.items.add(new File([blob], "photo.png", { type: "image/png" }));
          const input = document.querySelector('input[name="upload"]') as HTMLInputElement;
          input.files = transfer.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
          resolve();
        }, "image/png");
      }),
    { busy: kind === "busy", ...size },
  );
}

test("a chosen photo opens a crop that already frames the object", async ({ page }) => {
  await page.goto("/capture");
  await drawPhoto(page, "object");

  await expect(page.getByRole("heading", { name: "Crop your photo" })).toBeVisible({
    timeout: 15000,
  });
  const area = page.getByRole("button", { name: /^Crop area/ });
  await expect(area).not.toHaveAccessibleName(/the whole photo/);
  await expect(page.getByRole("button", { name: "Upload photo" })).toHaveCount(0);
  await expectNoAxeViolations(page);

  await pressDone(page);
  const preview = page.getByAltText("Your photo");
  await expect(preview).toHaveAttribute("data-width", /\d+/);
  // The 200px square plus a small margin, not the whole 800 by 600 photo.
  const width = Number(await preview.getAttribute("data-width"));
  expect(width).toBeGreaterThanOrEqual(200);
  expect(width).toBeLessThan(300);
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeEnabled();
});

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
]) {
  test(`a tall photo's crop step fits one ${viewport.name} screen, actions included`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/capture");
    await drawPhoto(page, "object", { width: 600, height: 1200 });
    const heading = page.getByRole("heading", { name: "Crop your photo" });
    await expect(heading).toBeVisible({ timeout: 15000 });

    const top = (await heading.boundingBox())?.y ?? 0;
    const done = await page.getByRole("button", { name: "Done" }).boundingBox();
    // Below the sticky header, the heading, photo and Done all fit in one screen.
    expect((done?.y ?? Infinity) + (done?.height ?? 0) - top).toBeLessThan(viewport.height - 80);
    const frame = await page.locator(".crop-overlay").boundingBox();
    const photo = await page.getByAltText("Your photo").boundingBox();
    expect(Math.abs((frame?.width ?? 0) / (frame?.height ?? 1) - 0.5)).toBeLessThan(0.01);
    expect(photo?.width).toBeCloseTo(frame?.width ?? 0, 0);
  });
}

test("a photo the object fills keeps the whole photo", async ({ page }) => {
  await page.goto("/capture");
  await drawPhoto(page, "busy");
  await expect(page.getByRole("button", { name: /^Crop area, the whole photo/ })).toBeVisible({
    timeout: 15000,
  });
  // Already the whole photo, so the reset would do nothing and is not offered.
  await expect(page.getByRole("button", { name: "Use the whole photo" })).toHaveCount(0);
  await pressDone(page);
  await expect(page.getByAltText("Your photo")).toHaveAttribute("data-width", "800");
});

test("the crop works from the keyboard, resets to the whole photo, and can be redone", async ({
  page,
}) => {
  await page.goto("/capture");
  await drawPhoto(page, "object");
  const area = page.getByRole("button", { name: /^Crop area/ });
  await area.focus();
  const before = await area.getAttribute("aria-label");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(area).not.toHaveAttribute("aria-label", before ?? "");

  await page.getByRole("button", { name: "Use the whole photo" }).click();
  await expect(area).toHaveAccessibleName(/the whole photo/);
  await expect(page.getByRole("button", { name: "Use the whole photo" })).toHaveCount(0);
  await pressDone(page);
  await expect(page.getByAltText("Your photo")).toHaveAttribute("data-width", "800");

  await page.getByRole("button", { name: "Crop again" }).click();
  await expect(page.getByRole("heading", { name: "Crop your photo" })).toBeVisible();
});
