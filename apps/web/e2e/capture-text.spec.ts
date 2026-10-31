import { expectNoAxeViolations } from "./a11y";
import { expectLessonOpened, lessonRequests } from "./mock-api";
import { expect, test } from "@playwright/test";

test("describing anything starts a lesson on it, with no catalogue search", async ({ page }) => {
  const sent = lessonRequests(page);
  await page.goto("/capture");
  const section = page.getByRole("region", { name: "No image? Describe it instead" });
  await expectNoAxeViolations(page);

  await section.getByLabel("What is it?").fill("  a rainbow   after rain ");
  await section.getByRole("button", { name: "Start lesson" }).click();
  await expectLessonOpened(page, "Rainbow after rain");
  await expect
    .poll(() => sent.at(0))
    .toMatchObject({
      subject: "Rainbow after rain",
      question: "What is the science behind the rainbow after rain?",
    });
});

test("text entry works from the keyboard alone", async ({ page }) => {
  await page.goto("/capture");
  const section = page.getByRole("region", { name: "No image? Describe it instead" });
  await section.getByLabel("What is it?").focus();
  await page.keyboard.type("bike bell");
  await page.keyboard.press("Enter");
  await expectLessonOpened(page, "Bike bell");
});

test("too short a description is explained at the field", async ({ page }) => {
  await page.goto("/capture");
  const section = page.getByRole("region", { name: "No image? Describe it instead" });
  await section.getByRole("button", { name: "Start lesson" }).click();
  const field = section.getByLabel("What is it?");
  await expect(field).toBeFocused();
  await expect(field).toHaveAccessibleDescription(/Type at least 2 letters\./);
  await expect(page).toHaveURL(/\/capture$/);
  await expectNoAxeViolations(page);
});
