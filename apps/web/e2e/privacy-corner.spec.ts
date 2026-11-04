import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./a11y";
import { mockApi } from "./mock-api";

// A first visit: nothing remembered, so the notes start open.
test.use({ storageState: { cookies: [], origins: [] } });

test("privacy notes open on a first visit, fold into a tab, and stay folded", async ({ page }) => {
  await mockApi(page, "/account", () => ({ status: 401, json: { error: "Not signed in." } }));
  await page.goto("/");

  const notes = page.getByRole("region", { name: "Your privacy here" });
  await expect(notes).toContainText("None while you are signed out");
  await expect(notes.getByRole("link", { name: "See and change your choices" })).toHaveAttribute(
    "href",
    "/privacy#choices",
  );
  await expectNoAxeViolations(page);

  await expect(notes.getByRole("group")).toHaveCount(5);
  await page.getByRole("button", { name: "Hide" }).click();
  await expect(notes).toBeHidden();
  const tab = page.getByRole("button", { name: "Privacy 5 to answer" });
  await expect(tab).toHaveAttribute("aria-expanded", "false");

  await page.reload();
  await expect(tab).toBeVisible();
  await expect(notes).toBeHidden();

  await tab.click();
  await expect(notes).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(notes).toBeHidden();
  await expect(tab).toBeFocused();
});

test("privacy notes mention the sign-in cookie once signed in", async ({ page }) => {
  await mockApi(page, "/account", () => ({
    json: {
      accountId: "0192f1a0-0000-7000-8000-0000000000aa",
      firstName: "Sam",
      lastName: "Lee",
      email: "sam@example.com",
      emailVerified: true,
      linkedAt: null,
    },
  }));
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Your privacy here" })).toContainText(
    "One, to keep you signed in",
  );
});

test("the privacy page does not repeat the notes", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Privacy/ })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Take part in research" })).toBeVisible();
});

test("each request is accepted or declined on its own, and the tab counts what is left", async ({
  page,
}) => {
  await mockApi(page, "/account", () => ({ status: 401, json: { error: "Not signed in." } }));
  await page.goto("/");
  const notes = page.getByRole("region", { name: "Your privacy here" });

  const research = notes.getByRole("group", { name: "Take part in research" });
  await research.getByRole("button", { name: "Decline" }).click();
  await expect(research.getByRole("button", { name: "Decline" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const improve = notes.getByRole("group", { name: "Help improve lessons" });
  await improve.getByRole("button", { name: "Accept" }).click();
  await expect(improve.getByRole("button", { name: "Accept" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Hide" }).click();
  await expect(page.getByRole("button", { name: "Privacy 3 to answer" })).toBeVisible();

  await page.getByRole("button", { name: "Privacy 3 to answer" }).click();
  await notes.getByRole("button", { name: "Decline all" }).click();
  await expect(notes.locator('[aria-pressed="true"]', { hasText: "Decline" })).toHaveCount(5);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("sbi.consent") ?? "{}"));
  expect(stored.choices).toEqual({
    "save-photos": false,
    account: false,
    "model-improvement": false,
    research: false,
    "usage-statistics": false,
  });
});
