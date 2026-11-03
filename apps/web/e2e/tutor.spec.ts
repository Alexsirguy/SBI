import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  SAMPLE_ANSWER,
  SAMPLE_LESSON,
  SAMPLE_SOURCES,
  sseFrames,
} from "../app/lesson/sample-lesson";
import { expectNoAxeViolations } from "./a11y";
import { mockApi, mockLesson } from "./mock-api";

// The e2e build switches the tutor on (ci.yml); the API's own flag is mocked here.
const LESSON_URL = "/lesson?taxonomyId=object.magnifying-glass&label=Magnifying+glass";
const refraction = SAMPLE_LESSON.claims[0]?.claimId;

async function openLesson(page: Page, locale = "en") {
  const asked: { text?: string; locale?: string }[] = [];
  await mockApi(page, "/account", () => ({ status: 401, json: { error: "Not signed in." } }));
  await mockApi(page, "/tutor/conversation?", () => ({ json: { exchanges: [] } }));
  await mockApi(page, "/tutor/turns", (body) => {
    const request = body as { text?: string; locale?: string };
    asked.push(request);
    return {
      json: {
        exchange: {
          turnId: crypto.randomUUID(),
          userText: request.text,
          text:
            locale === "es"
              ? "La luz se frena en el vidrio y se dobla."
              : "Light slows in glass, so it bends.",
          citedClaimIds: [refraction],
          kind: "lesson",
          createdAt: "2026-11-03T10:00:00.000Z",
        },
      },
    };
  });
  await mockLesson(
    page,
    sseFrames([
      { type: "quick-answer", data: SAMPLE_ANSWER },
      { type: "lesson", data: { ...SAMPLE_LESSON, locale } },
      { type: "sources", data: SAMPLE_SOURCES },
      { type: "visuals", data: { lessonId: SAMPLE_LESSON.lessonId, visuals: [] } },
    ]),
  );
  await page.goto(LESSON_URL);
  await expect(page.getByRole("status").first()).toHaveText(
    locale === "es" ? "Lección lista." : "Lesson ready.",
  );
  return asked;
}

async function apart(a: Locator, b: Locator) {
  const [one, two] = [await a.boundingBox(), await b.boundingBox()];
  if (!one || !two) throw new Error("both must be on screen");
  const overlap =
    one.x < two.x + two.width &&
    two.x < one.x + one.width &&
    one.y < two.y + two.height &&
    two.y < one.y + one.height;
  expect(overlap, "the tutor and the privacy tab overlap").toBe(false);
}

test("on a wide screen the tutor sits beside the lesson and answers with its sources", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const asked = await openLesson(page);
  const tutor = page.getByRole("complementary", { name: "Ask the tutor" });
  await expect(tutor).toBeVisible();

  const question = tutor.getByLabel("Your question");
  await question.fill("Why does it bend?");
  await question.press("Enter");

  const log = tutor.getByRole("log", { name: "Conversation with the tutor" });
  await expect(log).toContainText("Light slows in glass");
  await expect(log.getByRole("link", { name: "source 1" })).toHaveAttribute("href", "#source-1");
  expect(asked[0]).toMatchObject({ text: "Why does it bend?", locale: "en" });
  await expect(question).toHaveValue("");
  await apart(question, page.getByRole("button", { name: /^Privacy/ }));
  await expectNoAxeViolations(page);
});

for (const width of [390, 768]) {
  test(`at ${width}px the tutor opens as a sheet clear of the privacy tab`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openLesson(page);
    const launcher = page.getByRole("button", { name: "Ask the tutor" });
    await apart(launcher, page.getByRole("button", { name: /^Privacy/ }));

    await launcher.click();
    const sheet = page.getByRole("dialog", { name: "Ask the tutor" });
    await expect(sheet.getByLabel("Your question")).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(launcher).toBeFocused();
  });
}

test("the tutor speaks the lesson's language", async ({ page, context }) => {
  await context.addCookies([{ name: "sbi_locale", url: "http://localhost:3100", value: "es" }]);
  await page.setViewportSize({ width: 1280, height: 900 });
  const asked = await openLesson(page, "es");
  const tutor = page.getByRole("complementary", { name: "Pregunta al tutor" });
  await tutor.getByLabel("Tu pregunta").fill("¿Por qué se dobla?");
  await tutor.getByRole("button", { name: "Preguntar" }).click();
  await expect(tutor.getByRole("log")).toContainText("La luz se frena");
  expect(asked[0]).toMatchObject({ locale: "es" });
  await expectNoAxeViolations(page);
});
