import { expectNoAxeViolations } from "./a11y";
import { mockUploads } from "./mock-api";
import { expect, type Locator, type Page, test } from "@playwright/test";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

// Runs the shared confirmation step inside `scope`, the same way for either entry path.
async function confirmKettle(page: Page, scope: Locator) {
  await scope.getByLabel("Describe the object").fill("kettles");
  await scope.getByLabel("Describe the object").press("Enter");
  await expect(scope.getByRole("status").last()).toHaveText("1 match for “kettles”.");
  await scope.getByRole("button", { name: "Kettle" }).click();

  const heading = scope.getByRole("heading", { name: "Start this lesson?" });
  await expect(heading).toBeFocused();
  await expect(scope).toContainText("Lesson about: Kettle.");
  await expectNoAxeViolations(page);

  await scope.getByRole("button", { name: "Choose again" }).click();
  await expect(scope.getByRole("button", { name: "Kettle" })).toBeFocused();
  await scope.getByRole("button", { name: "Kettle" }).click();
  await scope.getByRole("button", { name: "Start lesson" }).click();
  await expect(scope.getByText("Starting lesson: Kettle.")).toBeFocused();
  await expectNoAxeViolations(page);
}

test("text entry resolves candidates and confirms the lesson", async ({ page }) => {
  await page.goto("/capture");
  await confirmKettle(page, page.getByRole("region", { name: "No camera? Describe it instead" }));
});

test("photo entry reaches the same confirmation step after upload", async ({ page }) => {
  await mockUploads(page);
  await page.goto("/capture");
  await page
    .locator('input[name="upload"]')
    .setInputFiles({ buffer: tinyPng, mimeType: "image/png", name: "object.png" });
  await page.getByRole("button", { name: "Upload photo" }).click({ timeout: 15000 });

  const photo = page.getByRole("region", { name: "What is in your photo?" });
  await expect(photo).toContainText("Describe it to start your lesson.");
  await confirmKettle(page, photo);
});

test("text entry works from the keyboard alone", async ({ page }) => {
  await page.goto("/capture");
  const section = page.getByRole("region", { name: "No camera? Describe it instead" });
  await section.getByLabel("Describe the object").focus();
  await page.keyboard.type("tea");
  await page.keyboard.press("Enter");
  await expect(section.getByRole("status")).toHaveText("2 matches for “tea”.");

  await section.getByRole("button", { name: "Teapot" }).focus();
  await page.keyboard.press("Enter");
  await expect(section.getByRole("heading", { name: "Start this lesson?" })).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(section.getByText("Starting lesson: Teapot.")).toBeVisible();
});

test("text entry guides on short, unmatched and edited queries", async ({ page }) => {
  await page.goto("/capture");
  const section = page.getByRole("region", { name: "No camera? Describe it instead" });
  const status = section.getByRole("status");

  await section.getByRole("button", { name: "Search objects" }).click();
  await expect(status).toHaveText("Type at least 2 letters to search.");

  await section.getByLabel("Describe the object").fill("spaceship");
  await section.getByRole("button", { name: "Search objects" }).click();
  await expect(status).toContainText("No matches for “spaceship”");
  await expect(section.getByLabel("Matching objects")).toHaveCount(0);

  await section.getByLabel("Describe the object").fill("tea");
  await section.getByRole("button", { name: "Search objects" }).click();
  await expect(section.getByLabel("Matching objects")).toBeVisible();
  await section.getByLabel("Describe the object").fill("tea cup");
  await expect(section.getByLabel("Matching objects")).toHaveCount(0);
  await expect(status).toHaveText("");
  await expectNoAxeViolations(page);
});
