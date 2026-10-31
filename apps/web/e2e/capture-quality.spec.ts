import { pressDone } from "./mock-api";
import { expectNoAxeViolations } from "./a11y";
import { expect, type Page, test } from "@playwright/test";

type Pattern = "black" | "checker" | "flat" | "white";

// Generates the photo in-page, since the repo keeps no binary fixtures.
async function selectPatternedPhoto(page: Page, pattern: Pattern) {
  await page.evaluate((kind) => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 300;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("no 2d context");
    }
    if (kind === "checker" || kind === "black") {
      for (let y = 0; y < 300; y += 10) {
        for (let x = 0; x < 400; x += 10) {
          const light = kind === "black" ? "#202020" : "#f0f0f0";
          context.fillStyle = (x + y) % 20 === 0 ? "#101010" : light;
          context.fillRect(x, y, 10, 10);
        }
      }
      context.fillStyle = kind === "black" ? "#181830" : "#4060c0";
      context.fillRect(120, 70, 160, 160);
    } else {
      context.fillStyle = { black: "#050505", flat: "#808080", white: "#ffffff" }[kind];
      context.fillRect(0, 0, 400, 300);
    }
    return new Promise<void>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("no blob"));
          return;
        }
        const transfer = new DataTransfer();
        transfer.items.add(new File([blob], `${kind}.png`, { type: "image/png" }));
        const input = document.querySelector('input[name="upload"]') as HTMLInputElement;
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        resolve();
      }, "image/png");
    });
  }, pattern);
}

test("a good photo shows no check results at all", async ({ page }) => {
  await page.goto("/capture");
  await selectPatternedPhoto(page, "checker");

  await pressDone(page);
  await expect(page.getByAltText("Your photo")).toBeVisible({ timeout: 15000 });

  await expect(page.getByText("This photo may be hard to recognise")).toHaveCount(0);
  await expect(page.getByText(/: good/)).toHaveCount(0);
});

test("a plain photo shows only what to fix, without blocking upload", async ({ page }) => {
  await page.goto("/capture");
  await selectPatternedPhoto(page, "flat");

  await pressDone(page);
  const issues = page.locator(".photo-issues");

  await expect(issues).toContainText("Hold the camera still", { timeout: 15000 });
  await expect(issues).toContainText("Move closer");
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Choose another photo" })).toBeVisible();
  await expect(page.getByRole("form", { name: "Photo capture" }).getByRole("status")).toHaveText(
    "Photo ready to upload, though it may be hard to recognise.",
  );
  await expectNoAxeViolations(page);
});

test("overexposed photo advises against glare", async ({ page }) => {
  await page.goto("/capture");
  await selectPatternedPhoto(page, "white");

  await pressDone(page);

  await expect(page.getByText("too bright")).toBeVisible({ timeout: 15000 });
});

test("underexposed photo advises finding better light", async ({ page }) => {
  await page.goto("/capture");
  await selectPatternedPhoto(page, "black");

  await pressDone(page);

  await expect(page.getByText("too dark")).toBeVisible({ timeout: 15000 });
});

test("checks that cannot run never stop the photo being used", async ({ page }) => {
  await page.addInitScript(() => {
    CanvasRenderingContext2D.prototype.getImageData = () => {
      throw new Error("blocked by privacy settings");
    };
  });
  await page.goto("/capture");
  await selectPatternedPhoto(page, "checker");

  await pressDone(page);

  await expect(page.getByAltText("Your photo")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeEnabled();
});
