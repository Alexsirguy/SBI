import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./a11y";

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

test("home page sells the idea with an example, the lesson shape, trust and a closing call", async ({
  page,
}) => {
  await page.goto("/");
  const example = page.getByRole("figure", {
    name: "How a lesson goes, shown with a magnifying glass",
  });
  await expect(example.getByRole("listitem")).toHaveText([
    "Show it",
    "Guess first",
    "Watch it work",
    "Your turn",
  ]);
  await expect(example).toContainText("Sources");
  for (const name of [
    "How a lesson works",
    "What's in every lesson",
    "Built so you can trust it",
    "For anyone who asks why",
  ]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  await expect(page.locator("#inside li")).toHaveCount(5);
  await expect(page.locator("#inside")).toContainText("Your turn");
  await page
    .getByRole("navigation", { name: "Footer" })
    .getByRole("link", { name: "What's in a lesson" })
    .click();
  await expect(page).toHaveURL(/\/#inside$/);
  await page.getByRole("link", { name: "Start your first lesson" }).click();
  await expect(page).toHaveURL(/\/capture$/);
});

test("the hero walkthrough moves only for those who allow motion, and can be paused", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const reel = page.getByRole("figure", { name: /How a lesson goes/ });
  const running = () =>
    reel.evaluate(
      (figure) =>
        figure.getAnimations({ subtree: true }).filter((item) => item.playState === "running")
          .length,
    );
  expect(await running()).toBeGreaterThan(0);
  const pause = reel.getByRole("button", { name: "Pause animation" });
  await pause.click();
  await expect(reel.getByRole("button", { name: "Play animation" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await running()).toBe(0);
  await expectNoAxeViolations(page);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  expect(await running()).toBe(0);
  await expect(reel.getByRole("button")).toBeHidden();
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

test("on phones the navigation folds behind a menu button that keyboards can use", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/about");
  const menu = page.getByRole("button", { name: "Menu" });
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(nav).toBeHidden();

  await menu.focus();
  await page.keyboard.press("Enter");
  const close = page.getByRole("button", { name: "Close menu" });
  await expect(close).toHaveAttribute("aria-expanded", "true");
  await expect(nav.getByRole("link", { name: "Privacy" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.keyboard.press("Escape");
  await expect(nav).toBeHidden();
  await expect(page.getByRole("button", { name: "Menu" })).toBeFocused();

  await page.getByRole("button", { name: "Menu" }).click();
  await nav.getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy");
  await expect(nav).toBeHidden();
});

test("the logo names the product and the footer groups its links", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Science Behind It", exact: true }),
  ).toBeVisible();
  const footer = page.getByRole("navigation", { name: "Footer" });
  for (const name of ["Start a lesson", "How lessons are checked", "Privacy", "Report a mistake"]) {
    await expect(footer.getByRole("link", { name })).toBeVisible();
  }
  await footer.getByRole("link", { name: "How lessons are checked" }).click();
  await expect(page).toHaveURL(/\/about#checks$/);
});
