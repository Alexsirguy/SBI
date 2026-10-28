import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("text entry resolves candidates and confirms the same way", async ({ page }) => {
  await page.goto("/capture");

  await page.getByLabel("Describe the object").fill("kettle");
  await page.getByRole("button", { name: "Search objects" }).click();
  await expect(page.getByLabel("Matching objects")).toContainText("Kettle");

  await page.getByRole("button", { name: "Kettle" }).click();
  await expect(page.getByLabel("Confirm lesson start")).toContainText("Lesson about: Kettle.");

  await page.getByRole("button", { name: "Start lesson" }).click();
  await expect(page.getByText("Starting lesson: Kettle.")).toBeVisible();
});

test("text entry guides on empty and unmatched queries", async ({ page }) => {
  await page.goto("/capture");

  await page.getByRole("button", { name: "Search objects" }).click();
  await expect(page.getByText("No matches yet")).toBeVisible();

  await page.getByLabel("Describe the object").fill("spaceship");
  await page.getByRole("button", { name: "Search objects" }).click();
  await expect(page.getByText("No matches yet")).toBeVisible();
  await expect(page.getByLabel("Matching objects")).toHaveCount(0);
});

test("text entry has no detectable accessibility violations", async ({ page }) => {
  await page.goto("/capture");
  await page.getByLabel("Describe the object").fill("tea");
  await page.getByRole("button", { name: "Search objects" }).click();
  await expect(page.getByLabel("Matching objects")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
