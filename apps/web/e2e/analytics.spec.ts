import { expect, test, type Page } from "@playwright/test";
import {
  SAMPLE_ANSWER,
  SAMPLE_LESSON,
  SAMPLE_SOURCES,
  sseFrames,
} from "../app/lesson/sample-lesson";
import { mockApi, mockLesson } from "./mock-api";

// The e2e build sets a test token (ci.yml); without one nothing is ever sent, so there is nothing to check.
test.skip(!process.env.NEXT_PUBLIC_MIXPANEL_TOKEN, "built without a Mixpanel token");

const SECRET = "why does grandma's kettle whistle at midnight";
const LESSON_URL = `/lesson?taxonomyId=object.magnifying-glass&label=Magnifying+glass&q=${encodeURIComponent(SECRET)}`;
const TUTOR_TEXT = "Is the kettle in my kitchen on Elm Street safe?";

interface Sent {
  event: string;
  properties: Record<string, unknown>;
}

// Mixpanel sends `data=` as base64 or JSON; this reads either, so the test sees what left the page.
function decode(body: string): Sent[] {
  const data = new URLSearchParams(body).get("data") ?? body;
  const json =
    data.trim().startsWith("[") || data.trim().startsWith("{")
      ? data
      : Buffer.from(data, "base64").toString("utf8");
  const parsed = JSON.parse(json) as Sent | Sent[];
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function watchMixpanel(page: Page) {
  const sent: Sent[] = [];
  const raw: string[] = [];
  await page.route("https://api-eu.mixpanel.com/**", async (route) => {
    const request = route.request();
    const body = request.postData() ?? new URL(request.url()).searchParams.get("data") ?? "";
    raw.push(`${request.url()}\n${body}`);
    if (body) sent.push(...decode(body));
    await route.fulfill({ status: 200, body: "1" });
  });
  return { sent, raw };
}

async function consent(page: Page, allowed: boolean) {
  await page.addInitScript((value) => {
    localStorage.setItem(
      "sbi.consent",
      JSON.stringify({
        version: "consent-2",
        choices: { "usage-statistics": value },
        decidedAt: "2026-11-04T10:00:00.000Z",
      }),
    );
  }, allowed);
}

async function openLesson(page: Page) {
  await mockApi(page, "/account", () => ({ status: 401, json: { error: "Not signed in." } }));
  await mockApi(page, "/tutor/conversation?", () => ({ json: { exchanges: [] } }));
  await mockApi(page, "/tutor/turns", (body) => ({
    json: {
      exchange: {
        turnId: crypto.randomUUID(),
        userText: (body as { text: string }).text,
        text: "Light slows in glass, so it bends.",
        citedClaimIds: [SAMPLE_LESSON.claims[0]?.claimId],
        kind: "lesson",
        createdAt: "2026-11-04T10:00:00.000Z",
      },
    },
  }));
  await mockLesson(
    page,
    sseFrames([
      { type: "quick-answer", data: SAMPLE_ANSWER },
      { type: "lesson", data: SAMPLE_LESSON },
      { type: "sources", data: SAMPLE_SOURCES },
      { type: "visuals", data: { lessonId: SAMPLE_LESSON.lessonId, visuals: [] } },
    ]),
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(LESSON_URL);
  await expect(page.getByRole("status").first()).toHaveText("Lesson ready.");
}

async function askTutor(page: Page) {
  const tutor = page.getByRole("complementary", { name: "Ask the tutor" });
  await tutor.getByLabel("Your question").fill(TUTOR_TEXT);
  await tutor.getByLabel("Your question").press("Enter");
  await expect(tutor.getByRole("log")).toContainText("Light slows in glass");
}

test("with consent, events reach Mixpanel's EU endpoint without the learner's words or URL", async ({
  page,
}) => {
  const mixpanel = await watchMixpanel(page);
  await consent(page, true);
  await openLesson(page);
  await askTutor(page);

  await expect
    .poll(() => mixpanel.sent.map((item) => item.event))
    .toEqual(expect.arrayContaining(["lesson_first_content", "tutor_question"]));
  const all = mixpanel.raw.join("\n") + JSON.stringify(mixpanel.sent);
  expect(all).not.toContain("grandma");
  expect(all).not.toContain("Elm Street");
  // Only events: no people profile is ever built for a visit.
  expect(mixpanel.raw.filter((call) => !call.includes("/track/"))).toEqual([]);
  for (const { event, properties } of mixpanel.sent) {
    expect(event.startsWith("$")).toBe(false);
    expect(properties).not.toHaveProperty("$current_url");
    expect(properties).not.toHaveProperty("$referrer");
    expect(properties).toMatchObject({ consentVersion: "consent-2", route: "lesson" });
  }
  const ids = new Set(mixpanel.sent.map(({ properties }) => properties.distinct_id));
  expect(ids.size).toBe(1);
});

test("without consent nothing is sent", async ({ page }) => {
  const mixpanel = await watchMixpanel(page);
  await consent(page, false);
  await openLesson(page);
  await askTutor(page);
  await page.waitForTimeout(500);
  expect(mixpanel.raw).toEqual([]);
});

test("the child pathway sends nothing, even with an earlier yes", async ({ page, context }) => {
  await context.addCookies([{ name: "sbi_pathway", url: "http://localhost:3100", value: "child" }]);
  const mixpanel = await watchMixpanel(page);
  await consent(page, true);
  await openLesson(page);
  await askTutor(page);
  await page.waitForTimeout(500);
  expect(mixpanel.raw).toEqual([]);
});

async function scriptBytes(page: Page) {
  await page.waitForLoadState("networkidle");
  return page.evaluate(() =>
    (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
      .filter((entry) => new URL(entry.name).pathname.endsWith(".js"))
      .reduce((sum, entry) => sum + entry.encodedBodySize, 0),
  );
}

test("Mixpanel adds at most 40 KB, and only once the learner says yes", async ({ browser }) => {
  const measure = async (allowed: boolean) => {
    const page = await browser.newPage();
    await watchMixpanel(page);
    await consent(page, allowed);
    await openLesson(page);
    const bytes = await scriptBytes(page);
    await page.close();
    return bytes;
  };
  const declined = await measure(false);
  const accepted = await measure(true);
  expect(accepted - declined, "Mixpanel's compressed bytes").toBeLessThanOrEqual(40 * 1024);
  expect(accepted, "Mixpanel was never loaded").toBeGreaterThan(declined);
});
