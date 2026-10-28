import type { Page } from "@playwright/test";

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
}
