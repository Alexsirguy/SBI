import type { Page } from "@playwright/test";
import { createTaxonomy, SEED_TAXONOMY, searchObservations } from "@sbi/taxonomy";

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
export async function mockRecognition(page: Page, reply: { candidates: unknown[]; next: unknown }) {
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

// Answers search from the real taxonomy package, so specs exercise the shipped seed and ranking.
export async function mockTaxonomy(page: Page) {
  const taxonomy = createTaxonomy(SEED_TAXONOMY);
  await page.route(`${API_URL}/taxonomy/search?*`, (route) => {
    const query = new URL(route.request().url()).searchParams.get("q") ?? "";
    return route.fulfill({ headers: CORS, json: { results: taxonomy.search(query) } });
  });
}

/** Answers observations from the real taxonomy and returns the bodies the page sent. */
export async function mockObservations(page: Page) {
  const taxonomy = createTaxonomy(SEED_TAXONOMY);
  const sent: Record<string, string>[] = [];
  await mockApi(page, "/observations", (body) => {
    const notes = body as Record<string, string>;
    sent.push(notes);
    return { json: { results: searchObservations(taxonomy, Object.values(notes)) } };
  });
  return sent;
}
