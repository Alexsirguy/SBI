import { expectNoAxeViolations } from "./a11y";
import { expect, test } from "@playwright/test";

test("home page renders the product heading", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Science Behind It");
});

test("home page has no detectable accessibility violations", async ({ page }) => {
  await page.goto("/");

  await expectNoAxeViolations(page);
});
