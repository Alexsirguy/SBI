import { expectNoAxeViolations } from "./a11y";
import { expect, test } from "@playwright/test";

test("home page says what the product does and starts either path in one tap", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "What's the science behind that?",
  );
  await page.getByRole("link", { name: "Describe it instead" }).click();
  await expect(page).toHaveURL(/\/capture#text-entry$/);
  await page.goBack();
  await page.getByRole("link", { name: "Take a photo" }).click();
  await expect(page).toHaveURL(/\/capture$/);
});

test("every page shares the header, skip link and footer", async ({ page }) => {
  for (const path of ["/", "/capture", "/privacy", "/about"]) {
    await page.goto(path);
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Footer" })).toBeVisible();
    await expect(page.locator("main#main")).toHaveCount(1);
  }
  await page.goto("/about");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Privacy" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy");
});

for (const path of ["/", "/privacy", "/about"]) {
  test(`${path} has no detectable accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await expectNoAxeViolations(page);
  });
}
