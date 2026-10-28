import { expect, type Locator, type Page, test } from "@playwright/test";
import { expectNoAxeViolations } from "./a11y";

async function selectPhoto(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const canvas = document.createElement("canvas");
        canvas.width = 800;
        canvas.height = 600;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("no 2d context"));
          return;
        }
        for (let x = 0; x < 800; x += 20) {
          context.fillStyle = x % 40 ? "#202020" : "#e0e0e0";
          context.fillRect(x, 0, 20, 600);
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
  );
}

async function mockUploads(page: Page) {
  await page.route("**/api/uploads", (route) =>
    route.fulfill({ json: { expiresInSeconds: 300, token: "t", uploadUrl: "/fake-put" } }),
  );
  await page.route("**/fake-put", (route) => route.fulfill({ status: 200 }));
  await page.route("**/api/uploads/confirm", (route) =>
    route.fulfill({ json: { contentType: "image/jpeg", key: "photos/a.jpg" } }),
  );
}

async function expectVisibleFocus(target: Locator) {
  await expect(target).toBeFocused();
  const outline = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThanOrEqual(2);
}

// Tabs forward until `target` has focus, proving it is reachable without a pointer.
async function tabTo(page: Page, target: Locator, limit = 40) {
  for (let i = 0; i < limit; i += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("target was not reachable with Tab");
}

test("keyboard focus is clearly visible on every kind of control", async ({ page }) => {
  await page.goto("/capture");
  await tabTo(page, page.getByLabel("Take a photo"));
  await expectVisibleFocus(page.getByLabel("Take a photo"));
  await tabTo(page, page.getByRole("button", { name: "Search objects" }));
  await expectVisibleFocus(page.getByRole("button", { name: "Search objects" }));

  await selectPhoto(page);
  const area = page.getByRole("button", { name: /^Crop area/ });
  await expect(area).toBeVisible({ timeout: 15000 });
  await area.focus();
  await page.keyboard.press("Shift+ArrowLeft");
  await expectVisibleFocus(area);
});

test("the whole photo journey works from the keyboard alone", async ({ page }) => {
  await mockUploads(page);
  await page.goto("/capture");
  await selectPhoto(page);
  const form = page.getByRole("form", { name: "Photo capture" });
  await expect(form.getByRole("status")).toContainText("Ready: 800 by 600", { timeout: 15000 });

  await tabTo(page, page.getByRole("button", { name: /^Crop area/ }));
  await page.keyboard.press("Shift+ArrowLeft");
  await tabTo(page, page.getByRole("button", { name: "Apply crop" }));
  await page.keyboard.press("Enter");
  await expect(form.getByRole("status")).toContainText("Ready: 784 by 600", { timeout: 15000 });

  await tabTo(page, page.getByRole("button", { name: "Upload photo" }));
  await page.keyboard.press("Enter");
  const photo = page.getByRole("region", { name: "What is in your photo?" });
  await expect(photo).toBeVisible();

  await tabTo(page, photo.getByLabel("Describe the object"));
  await page.keyboard.type("bike");
  await page.keyboard.press("Enter");
  await tabTo(page, photo.getByRole("button", { name: "Bicycle" }));
  await page.keyboard.press("Enter");
  await expect(photo.getByRole("heading", { name: "Start this lesson?" })).toBeFocused();
  await tabTo(page, photo.getByRole("button", { name: "Start lesson" }));
  await page.keyboard.press("Space");
  await expect(photo.getByText("Starting lesson: Bicycle.")).toBeFocused();
});

test("busy and disabled states are explained to assistive technology", async ({ page }) => {
  await page.goto("/capture");
  const form = page.getByRole("form", { name: "Photo capture" });
  const upload = page.getByRole("button", { name: "Upload photo" });
  await expect(upload).toHaveAccessibleDescription("Take or choose a photo first.");
  await expect(form).toHaveAttribute("aria-busy", "false");

  await selectPhoto(page);
  await expect(form.getByRole("status")).toContainText("Ready", { timeout: 15000 });
  await expect(form).toHaveAttribute("aria-busy", "false");
  await expect(upload).not.toHaveAttribute("aria-describedby");
});

test("error and uploaded states have no accessibility violations", async ({ page }) => {
  await page.goto("/capture");
  await page
    .locator('input[name="upload"]')
    .setInputFiles({ buffer: Buffer.from("not a photo"), mimeType: "text/plain", name: "a.txt" });
  await expect(page.getByRole("form", { name: "Photo capture" }).getByRole("alert")).toContainText(
    "is not a photo",
  );
  await expectNoAxeViolations(page);

  await mockUploads(page);
  await selectPhoto(page);
  await page.getByRole("button", { name: "Upload photo" }).click({ timeout: 15000 });
  await expect(page.getByRole("region", { name: "What is in your photo?" })).toBeVisible();
  await expectNoAxeViolations(page);
});
