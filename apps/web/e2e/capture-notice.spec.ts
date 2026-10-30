import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./a11y";
import { mockObservations, mockTaxonomy, mockUploads } from "./mock-api";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await mockTaxonomy(page);
});

test("an unmatched search leads to prompts that find the object", async ({ page }) => {
  const sent = await mockObservations(page);
  await page.goto("/capture");
  const section = page.getByRole("region", { name: "No image? Describe it instead" });
  await section.getByLabel("Describe the object").fill("spaceship");
  await section.getByLabel("Describe the object").press("Enter");
  await expect(section.getByRole("status")).toContainText("No matches");

  await section.getByRole("button", { name: "Can't find it? Tell us what you notice" }).click();
  const form = section.getByRole("form", { name: "Tell us what you notice" });
  await expect(form.getByLabel("What shape is it?")).toBeFocused();
  await expectNoAxeViolations(page);
  await form.getByLabel("What shape is it?").fill("two wheels");
  await form.getByLabel("What does it do, or where did you find it?").fill("I ride it");
  await form.getByRole("button", { name: "Find matches" }).click();

  await expect(section.getByRole("status")).toHaveText(/match(es)? what you noticed\.$/);
  await expect(section.getByRole("button", { name: "Bicycle" })).toBeFocused();
  expect(sent).toEqual([{ guess: "", material: "", shape: "two wheels", use: "I ride it" }]);
  await page.keyboard.press("Enter");
  await expect(section.getByText("Lesson about: Bicycle.")).toBeVisible();
});

test("when nothing fits, the guess goes back to search and the gap is noted", async ({ page }) => {
  const sent = await mockObservations(page);
  await page.goto("/capture");
  const section = page.getByRole("region", { name: "No image? Describe it instead" });
  await section.getByLabel("Describe the object").fill("spaceship");
  await section.getByRole("button", { name: "Search objects" }).click();
  await section.getByRole("button", { name: "Can't find it? Tell us what you notice" }).click();

  const form = section.getByRole("form", { name: "Tell us what you notice" });
  await form.getByLabel("What is it made of?").fill("brass");
  await form.getByLabel("What do you think it is? (optional)").fill("penny farthing");
  await form.getByRole("button", { name: "Find matches" }).click();

  await expect(section.getByRole("status")).toHaveText(
    "Thanks. We have noted this so we can add it. Try other words, or pick the closest object.",
  );
  await expect(section.getByLabel("Describe the object")).toBeFocused();
  await expect(section.getByLabel("Describe the object")).toHaveValue("penny farthing");
  expect(sent).toHaveLength(1);
});

test("an empty observation form explains why it cannot be sent", async ({ page }) => {
  await page.goto("/capture");
  const section = page.getByRole("region", { name: "No image? Describe it instead" });
  await section.getByRole("button", { name: "Can't find it? Tell us what you notice" }).click();

  await expect(section.getByRole("button", { name: "Find matches" })).toBeDisabled();
  await expect(section.getByRole("button", { name: "Find matches" })).toHaveAccessibleDescription(
    "Fill in at least one answer.",
  );
});

test("an unrecognised photo offers the prompts straight away", async ({ page }) => {
  await mockUploads(page);
  await mockObservations(page);
  await page.goto("/capture");
  await page
    .locator('input[name="upload"]')
    .setInputFiles({ buffer: tinyPng, mimeType: "image/png", name: "object.png" });
  await page.getByRole("button", { name: "Upload photo" }).click({ timeout: 15000 });

  const photo = page.getByRole("region", { name: "What is in your photo?" });
  await photo.getByRole("button", { name: "Can't find it? Tell us what you notice" }).click();
  await photo.getByLabel("What does it do, or where did you find it?").fill("boil water for tea");
  await photo.getByRole("button", { name: "Find matches" }).click();

  await expect(photo.getByRole("button", { name: "Electric kettle" })).toBeFocused();
  await expectNoAxeViolations(page);
});
