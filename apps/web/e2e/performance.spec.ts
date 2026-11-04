import { expect, test, type Page } from "@playwright/test";
import {
  SAMPLE_ANSWER,
  SAMPLE_LESSON,
  SAMPLE_SOURCES,
  sseFrames,
} from "../app/lesson/sample-lesson";
import { mockApi, mockLesson } from "./mock-api";
import { emulateTier, TIERS, type Tier } from "./tiers";

// Front-end budgets per tier, with the API mocked so only our pages are timed (#82).
// The numbers and why they are set there: docs/operations/performance-budgets.md.
const BUDGETS: Record<
  Exclude<Tier, "mid">,
  { fcp: number; lcp: number; firstReadable: number; interactive: number; blocking: number }
> = {
  low: { fcp: 3000, lcp: 4000, firstReadable: 7000, interactive: 8000, blocking: 800 },
  desktop: { fcp: 1000, lcp: 1500, firstReadable: 1500, interactive: 2000, blocking: 200 },
};

const LESSON_URL = "/lesson?taxonomyId=object.magnifying-glass&label=Magnifying+glass";
const FULL = sseFrames([
  { type: "quick-answer", data: SAMPLE_ANSWER },
  { type: "lesson", data: SAMPLE_LESSON },
  { type: "sources", data: SAMPLE_SOURCES },
  { type: "visuals", data: { lessonId: SAMPLE_LESSON.lessonId, visuals: [] } },
]);

/** Paint timings and main-thread blocking, observed from the first byte of the page. */
async function observe(page: Page) {
  await page.addInitScript(() => {
    const store = { lcp: 0, blocking: 0 };
    (window as unknown as { __perf: typeof store }).__perf = store;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) store.lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    // Total blocking time: the part of each long task over 50 ms.
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) store.blocking += Math.max(0, entry.duration - 50);
    }).observe({ type: "longtask", buffered: true });
  });
}

async function read(page: Page) {
  return page.evaluate(() => {
    const perf = (window as unknown as { __perf: { lcp: number; blocking: number } }).__perf;
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? NaN;
    const mark = (name: string) =>
      (performance.getEntriesByName(`sbi:${name}`)[0] as PerformanceMark | undefined)?.startTime;
    return {
      fcp: Math.round(fcp),
      lcp: Math.round(perf.lcp),
      blocking: Math.round(perf.blocking),
      firstReadable: mark("first_readable_lesson"),
      interactive: mark("interactive_ready"),
    };
  });
}

// Timings need the machine to themselves; CI runs this file alone (ci.yml).
test.skip(!process.env.PERFORMANCE_BUDGETS, "set PERFORMANCE_BUDGETS=1 and run with --workers=1");
test.describe.configure({ mode: "serial" });

for (const tier of ["low", "desktop"] as const) {
  const budget = BUDGETS[tier];

  for (const path of ["/", "/capture"]) {
    test(`${path} paints within budget on the ${tier} tier`, async ({ page, context }) => {
      test.setTimeout(60_000);
      await observe(page);
      await emulateTier(context, page, tier);
      await page.goto(path, { waitUntil: "load" });
      await page.waitForTimeout(500);
      const measured = await read(page);
      test.info().annotations.push({ type: "measured", description: JSON.stringify(measured) });
      expect(measured.fcp, "first contentful paint (ms)").toBeLessThanOrEqual(budget.fcp);
      expect(measured.lcp, "largest contentful paint (ms)").toBeLessThanOrEqual(budget.lcp);
      expect(measured.blocking, "total blocking time (ms)").toBeLessThanOrEqual(budget.blocking);
    });
  }

  test(`a lesson is readable and interactive within budget on the ${tier} tier`, async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await mockApi(page, "/account", () => ({ status: 401, json: { error: "Not signed in." } }));
    await mockLesson(page, FULL);
    await observe(page);
    await emulateTier(context, page, tier);
    await page.goto(LESSON_URL);
    await expect(page.getByRole("status").first()).toHaveText("Lesson ready.", { timeout: 30_000 });
    await page.waitForFunction(() => performance.getEntriesByName("sbi:interactive_ready").length);
    const measured = await read(page);
    test.info().annotations.push({ type: "measured", description: JSON.stringify(measured) });
    expect(measured.firstReadable, "first readable lesson (ms)").toBeLessThanOrEqual(
      budget.firstReadable,
    );
    expect(measured.interactive, "interactive-ready (ms)").toBeLessThanOrEqual(budget.interactive);
    expect(measured.blocking, "total blocking time (ms)").toBeLessThanOrEqual(budget.blocking);
  });
}

test("the tiers cover a slow phone, a mid phone and a laptop", () => {
  expect(Object.keys(TIERS)).toEqual(["low", "mid", "desktop"]);
});
