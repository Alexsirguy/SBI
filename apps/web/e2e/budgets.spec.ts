import { expect, test, type Page } from "@playwright/test";
import {
  SAMPLE_ANSWER,
  SAMPLE_LESSON,
  SAMPLE_SOURCES,
  sseFrames,
} from "../app/lesson/sample-lesson";
import { mockLesson } from "./mock-api";

// Compressed bytes per page on the production build (E15-6, #259); raise only with a reason.
const BUDGET = { js: 230 * 1024, css: 15 * 1024, font: 100 * 1024 };

const LESSON_URL = "/lesson?taxonomyId=object.magnifying-glass&label=Magnifying+glass";
const PAGES = ["/", "/capture", "/privacy", "/about", LESSON_URL];
const WIDTHS = [360, 768, 1280];

const FULL = sseFrames([
  { type: "quick-answer", data: SAMPLE_ANSWER },
  { type: "lesson", data: SAMPLE_LESSON },
  { type: "sources", data: SAMPLE_SOURCES },
  { type: "visuals", data: { lessonId: SAMPLE_LESSON.lessonId, visuals: [] } },
]);

async function open(page: Page, path: string) {
  await mockLesson(page, FULL);
  await page.goto(path, { waitUntil: "networkidle" });
  if (path === LESSON_URL)
    await expect(page.getByRole("status").first()).toHaveText("Lesson ready.");
}

for (const path of PAGES) {
  test(`${path} stays within its weight budget`, async ({ page }) => {
    await open(page, path);
    const weight = await page.evaluate(() => {
      const sum = { js: 0, css: 0, font: 0 };
      for (const entry of performance.getEntriesByType("resource") as PerformanceResourceTiming[]) {
        const url = new URL(entry.name).pathname;
        if (url.endsWith(".js")) sum.js += entry.encodedBodySize;
        else if (url.endsWith(".css")) sum.css += entry.encodedBodySize;
        else if (/\.(woff2?|ttf|otf)$/.test(url)) sum.font += entry.encodedBodySize;
      }
      return sum;
    });
    expect(weight.js, "JavaScript bytes").toBeLessThanOrEqual(BUDGET.js);
    expect(weight.css, "CSS bytes").toBeLessThanOrEqual(BUDGET.css);
    expect(weight.font, "font bytes").toBeLessThanOrEqual(BUDGET.font);
  });

  for (const width of WIDTHS) {
    test(`${path} fits ${width}px with touch-sized controls`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, path);
      const report = await page.evaluate(() => {
        const overflow =
          document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const small: string[] = [];
        const controls = document.querySelectorAll<HTMLElement>(
          "button, select, textarea, summary, input:not([type=radio]):not([type=checkbox]):not([type=hidden]), .sbi-button, nav a, .citation-marker",
        );
        const radios = [...document.querySelectorAll<HTMLInputElement>("input[type=radio]")].map(
          (input) => input.closest("label") as HTMLElement | null,
        );
        for (const element of [...controls, ...radios]) {
          if (!element) continue;
          const box = element.getBoundingClientRect();
          // Hidden or off-screen-by-design elements (skip link until focused) are not targets.
          if (box.width === 0 || box.height === 0 || box.bottom < 0) continue;
          if (box.height < 43.5 || box.width < 24) {
            small.push(
              `${element.tagName.toLowerCase()} "${(element.textContent ?? "").trim().slice(0, 30)}" ${Math.round(box.width)}x${Math.round(box.height)}`,
            );
          }
        }
        return { overflow, small };
      });
      expect(report.overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);
      expect(report.small, "controls under 44px tall").toEqual([]);
    });
  }
}

test("reduced motion stops placeholders and the reading bar from moving", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockLesson(page, null);
  await page.goto(LESSON_URL);
  const line = page.locator(".sbi-placeholder__line").first();
  await expect(line).toBeAttached();
  expect(await line.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  // The minifier may write the zero as 0s or 0ms; either means no movement.
  const duration = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--sbi-duration-settle").trim(),
  );
  expect(parseFloat(duration)).toBe(0);
});
