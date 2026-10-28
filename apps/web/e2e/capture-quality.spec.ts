import { expect, type Page, test } from "@playwright/test";

type Pattern = "checker" | "flat" | "white";

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
    if (kind === "checker") {
      for (let y = 0; y < 300; y += 10) {
        for (let x = 0; x < 400; x += 10) {
          context.fillStyle = (x + y) % 20 === 0 ? "#101010" : "#f0f0f0";
          context.fillRect(x, y, 10, 10);
        }
      }
      context.fillStyle = "#4060c0";
      context.fillRect(120, 70, 160, 160);
    } else {
      context.fillStyle = kind === "white" ? "#ffffff" : "#808080";
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

test("sharp, well-framed photo passes every check", async ({ page }) => {
  await page.goto("/capture");
  await selectPatternedPhoto(page, "checker");
  const check = page.getByLabel("Photo check");

  await expect(check).toContainText("Sharpness: good", { timeout: 15000 });
  await expect(check).toContainText("Exposure: good");
  await expect(check).toContainText("Object size: good");
});

test("plain photo gets actionable retake guidance without blocking upload", async ({ page }) => {
  await page.goto("/capture");
  await selectPatternedPhoto(page, "flat");
  const check = page.getByLabel("Photo check");

  await expect(check).toContainText("Hold the camera still", { timeout: 15000 });
  await expect(check).toContainText("Move closer");
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeEnabled();
});

test("overexposed photo advises against glare", async ({ page }) => {
  await page.goto("/capture");
  await selectPatternedPhoto(page, "white");

  await expect(page.getByLabel("Photo check")).toContainText("too bright", { timeout: 15000 });
});
