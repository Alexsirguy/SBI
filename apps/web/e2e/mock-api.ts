import { expect, type Page } from "@playwright/test";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const STORAGE_PUT = "https://storage.test/fake-put";
export const PHOTO_KEY = "photos/0192f1a0-0000-7000-8000-000000000001.jpg";

// The API and bucket are other origins, so mocks must answer CORS preflights like the real ones.
const CORS = {
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET, POST, PUT",
  "access-control-allow-origin": "*",
};

export async function mockApi(
  page: Page,
  path: string,
  reply: (body: unknown) => { status?: number; json: unknown },
) {
  await page.route(`${API_URL}${path}`, async (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ headers: CORS, status: 204 });
    }
    const { json, status = 200 } = reply(route.request().postDataJSON());
    return route.fulfill({ headers: CORS, json, status });
  });
}

export async function mockUploads(page: Page) {
  await mockApi(page, "/uploads", () => ({
    json: { expiresInSeconds: 300, token: "t", uploadUrl: STORAGE_PUT },
  }));
  await page.route(STORAGE_PUT, (route) =>
    route.fulfill({ headers: CORS, status: route.request().method() === "OPTIONS" ? 204 : 200 }),
  );
  await mockApi(page, "/uploads/confirm", () => ({
    json: { contentType: "image/jpeg", key: PHOTO_KEY },
  }));
  // Specs see the describe fallback, as when recognition is switched off, unless they opt in.
  await mockApi(page, "/recognitions", () => ({ json: { error: RECOGNITION_OFF }, status: 503 }));
}

export const RECOGNITION_OFF =
  "We could not recognise the photo right now. Describe the object instead.";
export const RESULT_ID = "0192f1a0-0000-7000-9000-000000000005";
export const SESSION_ID = "0192f1a0-0000-7000-8000-000000000011";

/** Answers recognition with `reply` and returns the selections the page records. */
export async function mockRecognition(
  page: Page,
  reply: { candidates: unknown[]; otherLabels?: string[]; options?: unknown[]; next: unknown },
) {
  const selections: unknown[] = [];
  const requests: unknown[] = [];
  await mockApi(page, "/recognitions", (body) => {
    requests.push(body);
    return { json: { resultId: RESULT_ID, sessionId: SESSION_ID, ...reply } };
  });
  await mockApi(page, "/recognitions/selection", (body) => {
    selections.push(body);
    return { json: { recorded: true } };
  });
  return { requests, selections };
}

/** Returns the lesson requests the reader sends, whatever the mocked reply. */
export function lessonRequests(page: Page) {
  const sent: Record<string, unknown>[] = [];
  page.on("request", (request) => {
    if (request.url() === `${API_URL}/lessons` && request.method() === "POST") {
      sent.push(request.postDataJSON() as Record<string, unknown>);
    }
  });
  return sent;
}

/** Answers POST /lessons with server-sent event frames, or holds it open when `frames` is null. */
export async function mockLesson(page: Page, frames: string | null, status = 200) {
  await page.route(`${API_URL}/lessons`, async (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ headers: CORS, status: 204 });
    }
    if (frames === null) return;
    return route.fulfill({
      body: frames,
      headers: {
        ...CORS,
        "content-type": status === 200 ? "text/event-stream" : "application/json",
      },
      status,
    });
  });
}

/** Asserts that starting a lesson opened the reader for `label`. */
export async function expectLessonOpened(page: Page, label: string) {
  await expect(page).toHaveURL(/\/lesson\?/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Lesson: ${label}`);
}

/** Accepts the suggested crop, the step between choosing a photo and uploading it. */
export async function pressDone(page: Page) {
  await page.getByRole("button", { name: "Done" }).click({ timeout: 15000 });
}

/** Serves the gallery's playgrounds as the API would: the frame document with its own CSP. */
export async function mockPlaygrounds(page: Page) {
  const { GALLERY_FIXTURES } = await import("@sbi/visuals");
  const { playgroundDocument } = await import("@sbi/visuals/playground-document");
  await page.route(`${API_URL}/playgrounds?*`, async (route) => {
    const visualId = new URL(route.request().url()).searchParams.get("visualId");
    const manifest = GALLERY_FIXTURES.find((item) => item.visualId === visualId);
    const code = (manifest?.spec as { code?: string } | undefined)?.code;
    if (!code) return route.fulfill({ status: 404, body: "" });
    // Framed by the page under test, as the API allows the web origins it is configured with.
    const { html, csp } = await playgroundDocument(code, {
      frameAncestors: [new URL(page.url()).origin],
    });
    return route.fulfill({
      status: 200,
      body: html,
      headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": csp },
    });
  });
}
