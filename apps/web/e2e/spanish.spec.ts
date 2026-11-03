import { expect, test } from "@playwright/test";
import { SAMPLE_ANSWER, SAMPLE_LESSON, sseFrames } from "../app/lesson/sample-lesson";
import { expectNoAxeViolations } from "./a11y";
import { mockApi, mockLesson } from "./mock-api";

const LESSON_URL = "/lesson?taxonomyId=object.magnifying-glass&label=Magnifying+glass";

test("choosing Español switches the site, and is remembered", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByLabel("Language").selectOption("es");

  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  const nav = page.getByRole("navigation", { name: "Principal" });
  await expect(nav.getByRole("link", { name: "Cómo funciona" })).toBeVisible();
  // The refresh streams metadata in after the body; check the settled page, title included.
  await expect(page).toHaveTitle(/Science Behind It/);
  await expectNoAxeViolations(page);

  await page.goto("/privacy");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacidad");
});

test("a Spanish-speaking browser gets Spanish without choosing", async ({ browser }) => {
  const context = await browser.newContext({ locale: "es-MX" });
  const page = await context.newPage();
  await page.goto("/account/sign-in");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
  await expectNoAxeViolations(page);
  await context.close();
});

test("lessons are asked for in Spanish when the site is in Spanish", async ({ page, context }) => {
  await context.addCookies([{ name: "sbi_locale", url: "http://localhost:3100", value: "es" }]);
  let asked: { locale?: string; question?: string } | undefined;
  await mockLesson(
    page,
    sseFrames([
      { type: "quick-answer", data: SAMPLE_ANSWER },
      { type: "lesson", data: SAMPLE_LESSON },
      { type: "visuals", data: { lessonId: SAMPLE_LESSON.lessonId, visuals: [] } },
    ]),
  );
  // Registered last so it runs first, recording the request before the mock answers it.
  await page.route("**/lessons", async (route) => {
    if (route.request().method() === "POST") asked = route.request().postDataJSON();
    return route.fallback();
  });
  await mockApi(page, "/account", () => ({ json: { error: "x" }, status: 401 }));
  await page.goto(LESSON_URL);

  await expect.poll(() => asked?.locale).toBe("es");
  expect(asked?.question).toMatch(/^¿Cuál es la ciencia detrás de/);
  await expect(
    page.getByRole("link", { name: "Inicia sesión para guardar esta lección" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
});
