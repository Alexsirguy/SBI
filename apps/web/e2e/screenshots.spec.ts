import { expect, test, type Page } from "@playwright/test";
import {
  SAMPLE_ANSWER,
  SAMPLE_LESSON,
  SAMPLE_SOURCES,
  sseFrames,
} from "../app/lesson/sample-lesson";
import { mockApi, mockLesson, mockRecognition, mockUploads, pressDone } from "./mock-api";

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

// A reply from the lesson's sources and one from beyond them, so both kinds are seen.
const TUTOR_EXCHANGES = [
  {
    turnId: "0192f1a0-0000-7000-8000-00000000d001",
    userText: "Why does it bend?",
    text: "Light slows down in glass, so it bends at the curved surface.",
    citedClaimIds: [SAMPLE_LESSON.claims[0]?.claimId],
    kind: "lesson",
    createdAt: "2026-11-03T10:00:00.000Z",
  },
  {
    turnId: "0192f1a0-0000-7000-8000-00000000d002",
    userText: "Do glasses work the same way?",
    text: "Yes: glasses are lenses too, shaped to move the image onto your retina.",
    citedClaimIds: [],
    kind: "beyond-lesson",
    note: "This goes beyond the lesson's sources, so it isn't checked against them.",
    createdAt: "2026-11-03T10:01:00.000Z",
  },
];

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 860 },
] as const;
const THEMES = ["light", "dark"] as const;

// The tutor loads after the lesson, so each lesson state waits for it to be drawn.
async function tutorDrawn(page: Page, exchanges: unknown[] = []) {
  await mockApi(page, "/tutor/conversation?", () => ({ json: { exchanges } }));
  return async () => {
    const wide = (page.viewportSize()?.width ?? 0) >= 1180;
    await expect(
      wide
        ? page.getByRole("complementary", { name: "Ask the tutor" })
        : page.getByRole("button", { name: "Ask the tutor" }),
    ).toBeVisible();
  };
}

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
}

// A pot-like circle on a plain backdrop, drawn in the page: the repo keeps no binary fixtures.
async function drawPhoto(page: Page) {
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
          context.fillStyle = "#4a5a66";
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
    name: "crop",
    open: async (page) => {
      await page.goto("/capture");
      await drawPhoto(page);
      await expect(page.getByRole("button", { name: /^Crop area/ })).toBeVisible({
        timeout: 15000,
      });
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
      await drawPhoto(page);
      await pressDone(page);
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
      const drawn = await tutorDrawn(page);
      await page.goto(LESSON_URL);
      await expect(page.getByRole("status").first()).toHaveText("Lesson ready.");
      await drawn();
    },
  },
  {
    name: "tutor",
    open: async (page) => {
      await mockLesson(page, FULL);
      const drawn = await tutorDrawn(page, TUTOR_EXCHANGES);
      await page.goto(LESSON_URL);
      await expect(page.getByRole("status").first()).toHaveText("Lesson ready.");
      await drawn();
      // Narrower than the docked layout (tutor.css), it opens from its button as a sheet.
      if ((page.viewportSize()?.width ?? 0) < 1180) {
        await page.getByRole("button", { name: "Ask the tutor" }).click();
      }
      await expect(page.getByRole("log")).toContainText("Light slows down in glass");
    },
  },
  {
    name: "lesson-sources",
    open: async (page) => {
      await mockLesson(page, FULL);
      const drawn = await tutorDrawn(page);
      await page.goto(`${LESSON_URL}#source-1`);
      await drawn();
      await expect(page.getByRole("region", { name: "Sources" })).toBeVisible();
      await page.getByRole("region", { name: "Sources" }).scrollIntoViewIfNeeded();
    },
  },
  {
    name: "teach",
    open: async (page) => {
      await mockApi(page, "/account", () => ({
        json: {
          accountId: "0192f1a0-0000-7000-8000-000000000001",
          email: "teacher@example.com",
          emailVerified: true,
          firstName: "Ngozi",
          lastName: "Okafor",
          linkedAt: null,
        },
      }));
      await mockApi(page, "/account/lessons", () => ({ json: { lessons: [] } }));
      await mockApi(page, "/classes", () => ({
        json: {
          classes: [
            {
              archivedAt: null,
              classId: "0192f1a0-0000-7000-8000-0000000000e1",
              codeHint: "PX",
              controls: {
                audienceLock: "teen",
                blockedCategories: ["weapons"],
                tutorEnabled: true,
              },
              createdAt: "2026-11-08T09:00:00.000Z",
              curriculum: "ng",
              lessons: [
                { lessonId: SAMPLE_LESSON.lessonId, title: SAMPLE_LESSON.title, version: 1 },
              ],
              level: "SSS2",
              name: "SSS2 Physics",
            },
          ],
          educator: true,
        },
      }));
      await mockApi(page, "/classes/summary?", () => ({
        json: {
          minCount: 5,
          totals: { check_answered: 58, check_correct: 41, lesson_opened: 73, visual_used: null },
          weeks: [
            {
              counts: {
                check_answered: 31,
                check_correct: 22,
                lesson_opened: 38,
                visual_used: null,
              },
              week: "2026-W45",
            },
            {
              counts: { check_answered: 27, check_correct: 19, lesson_opened: 35, visual_used: 0 },
              week: "2026-W44",
            },
          ],
        },
      }));
      await page.goto("/teach");
      await expect(page.getByRole("region", { name: "SSS2 Physics" })).toBeVisible();
      await expect(page.getByRole("table")).toBeVisible();
    },
  },
  {
    name: "class",
    open: async (page) => {
      await mockApi(page, "/class?", () => ({
        json: {
          controls: { audienceLock: null, blockedCategories: [], tutorEnabled: true },
          curriculum: "ng",
          lessons: [{ lessonId: SAMPLE_LESSON.lessonId, title: SAMPLE_LESSON.title, version: 1 }],
          level: "SSS2",
          name: "SSS2 Physics",
        },
      }));
      await page.goto("/class?code=7K3M-9QPX");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("SSS2 Physics");
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
