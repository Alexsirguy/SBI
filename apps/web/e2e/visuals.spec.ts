import { expect, test } from "@playwright/test";
import { GALLERY_FIXTURES } from "@sbi/visuals";
import { expectNoAxeViolations } from "./a11y";

test.describe("visual gallery", () => {
  test("shows every kind, falling back to its text until its renderer exists", async ({ page }) => {
    await page.goto("/visuals");
    for (const manifest of GALLERY_FIXTURES) {
      const figure = page.getByRole("figure", { name: manifest.alt });
      await expect(figure).toBeVisible();
      await expect(figure).toContainText(manifest.fallback.text);
    }
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expectNoAxeViolations(page);
  });
});
