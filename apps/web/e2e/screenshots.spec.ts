import { expect, test, type Page } from "@playwright/test";
import {
  SAMPLE_ANSWER,
  SAMPLE_LESSON,
  SAMPLE_SOURCES,
  sseFrames,
} from "../app/lesson/sample-lesson";
import { mockLesson, mockRecognition, mockUploads } from "./mock-api";

// Baselines are Linux renders (the CI runner); macOS draws text differently, so it skips.
// Regenerate with `pnpm --filter @sbi/web test:screenshots:update` (runs in Playwright's image).
test.skip(process.platform !== "linux", "screenshot baselines are rendered on Linux");

const LESSON_URL = "/lesson?taxonomyId=object.magnifying-glass&label=Magnifying+glass";
const FULL = sseFrames([
  { type: "quick-answer", data: SAMPLE_ANSWER },
  { type: "lesson", data: SAMPLE_LESSON },
  { type: "sources", data: SAMPLE_SOURCES },
  { type: "visuals", data: { lessonId: SAMPLE_LESSON.lessonId, visuals: [] } },
]);

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 860 },
] as const;
const THEMES = ["light", "dark"] as const;

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
}

const STATES: { name: string; open: (page: Page) => Promise<void> }[] = [
  {
    name: "home",
    open: async (page) => {
      await page.goto("/");
    },
  },
  {
    name: "capture",
    open: async (page) => {
      await page.goto("/capture");
    },
  },
  {
    name: "describe",
    open: async (page) => {
      await page.goto("/capture");
      const describe = page.getByRole("region", { name: "No image? Describe it instead" });
      await describe.getByLabel("What is it?").fill("a rainbow after rain");
      await describe.scrollIntoViewIfNeeded();
    },
  },
  {
    name: "choices",
    open: async (page) => {
      await mockUploads(page);
      await mockRecognition(page, {
        candidates: [],
        options: [
          { label: "Stovetop kettle", certainty: "possible" },
          { label: "Teapot", certainty: "possible" },
          { label: "Coffee pot", certainty: "unsure" },
        ],
        next: { kind: "describe" },
      });
      await page.goto("/capture");
      // A plain drawn photo: the repo keeps no binary fixtures.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            const canvas = document.createElement("canvas");
            canvas.width = 800;
            canvas.height = 600;
            const context = canvas.getContext("2d");
            if (context) {
              context.fillStyle = "#d8d2c4";
              context.fillRect(0, 0, 800, 600);
              context.fillStyle = "#8a9aa6";
              context.beginPath();
              context.arc(400, 340, 170, 0, Math.PI * 2);
              context.fill();
            }
            canvas.toBlob((blob) => {
              const transfer = new DataTransfer();
              if (blob) transfer.items.add(new File([blob], "pot.png", { type: "image/png" }));
              const input = document.querySelector('input[name="upload"]') as HTMLInputElement;
              input.files = transfer.files;
              input.dispatchEvent(new Event("change", { bubbles: true }));
              resolve();
            }, "image/png");
          }),
      );
      await page.getByRole("button", { name: "Upload photo" }).click({ timeout: 15000 });
      await expect(page.getByRole("heading", { name: "Which one is it?" })).toBeFocused();
    },
  },
  {
    name: "lesson-loading",
    open: async (page) => {
      await mockLesson(page, null);
      await page.goto(LESSON_URL);
    },
  },
  {
    name: "lesson",
    open: async (page) => {
      await mockLesson(page, FULL);
      await page.goto(LESSON_URL);
      await expect(page.getByRole("status").first()).toHaveText("Lesson ready.");
    },
  },
  {
    name: "lesson-sources",
    open: async (page) => {
      await mockLesson(page, FULL);
      await page.goto(`${LESSON_URL}#source-1`);
      await expect(page.getByRole("region", { name: "Sources" })).toBeVisible();
      await page.getByRole("region", { name: "Sources" }).scrollIntoViewIfNeeded();
    },
  },
];

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    for (const state of STATES) {
      test(`${state.name} on ${viewport.name} in ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await state.open(page);
        await settle(page);
        await expect(page).toHaveScreenshot(`${state.name}-${viewport.name}-${theme}.png`, {
          animations: "disabled",
          caret: "hide",
          // Small anti-aliasing differences between the image and the CI runner are not regressions.
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  }
}
