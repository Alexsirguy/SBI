import { ConfirmedPhoto, UploadTicket } from "@sbi/contracts";
import { issueUploadToken } from "@sbi/media";
import { afterEach, describe, expect, it } from "vitest";
import {
  fakeMedia,
  startTestApp,
  TOKEN_SECRET,
  WEB_ORIGIN,
  type TestApp,
} from "../testing/test-app";

const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

describe("media routes", () => {
  let test: TestApp | undefined;

  afterEach(async () => {
    await test?.app.close();
  });

  it("issues an upload ticket that matches the contract", async () => {
    test = await startTestApp();

    const response = await test.post("/uploads", { declaredType: "image/png", sizeBytes: 68 });

    expect(response.status).toBe(200);
    const ticket = UploadTicket.parse(await response.json());
    expect(ticket.uploadUrl).toMatch(/^https:\/\/storage\.test\/staging\//);
  });

  it("rejects malformed and disallowed upload requests", async () => {
    test = await startTestApp();

    for (const body of [{}, { declaredType: "image/png", sizeBytes: "1" }]) {
      const response = await test.post("/uploads", body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Describe the photo to upload: type and size.",
      });
    }
    const gif = await test.post("/uploads", { declaredType: "image/gif", sizeBytes: 10 });
    expect(gif.status).toBe(400);
    expect(await gif.json()).toHaveProperty("error");
  });

  it("confirms a staged photo, registers it and lets the learner keep it", async () => {
    const media = fakeMedia();
    test = await startTestApp(media);
    const issued = UploadTicket.parse(
      await (
        await test.post("/uploads", { declaredType: "image/png", sizeBytes: PNG.length })
      ).json(),
    );
    media.objects.set(new URL(issued.uploadUrl).pathname.slice(1), PNG);

    const confirmed = await test.post("/uploads/confirm", { token: issued.token });

    expect(confirmed.status).toBe(200);
    const photo = ConfirmedPhoto.parse(await confirmed.json());
    expect(media.records.map((record) => record.key)).toEqual([photo.key]);
    expect([...media.objects.keys()]).toEqual([photo.key]);

    const keep = await test.post("/photos/keep", { key: photo.key });
    expect(await keep.json()).toEqual({ kept: true });
    expect(media.kept.has(photo.key)).toBe(true);
  });

  it("refuses forged tokens and photos that could not be scanned", async () => {
    const media = fakeMedia({ reason: "down", status: "error" });
    test = await startTestApp(media);

    const forged = await test.post("/uploads/confirm", { token: "nope" });
    expect(forged.status).toBe(400);

    const token = await issueUploadToken(
      TOKEN_SECRET,
      "staging/x.png",
      new Date(Date.now() + 60_000),
    );
    media.objects.set("staging/x.png", PNG);
    const unscanned = await test.post("/uploads/confirm", { token });
    expect(unscanned.status).toBe(503);
    expect(media.objects.size).toBe(0);
  });

  it("reports invalid keys and photos deleted before they could be kept", async () => {
    test = await startTestApp();

    expect((await test.post("/photos/keep", { key: "staging/x.png" })).status).toBe(400);
    const gone = await test.post("/photos/keep", {
      key: "photos/0192f1a0-0000-7000-8000-000000000001.jpg",
    });
    expect(gone.status).toBe(409);
    expect(await gone.json()).toEqual({
      error: "This photo has already been deleted and cannot be kept.",
    });
  });

  it("allows cross-origin calls from the web app only", async () => {
    test = await startTestApp();
    const preflight = (origin: string) =>
      fetch(`${test?.url}/uploads`, {
        headers: {
          "access-control-request-headers": "content-type",
          "access-control-request-method": "POST",
          origin,
        },
        method: "OPTIONS",
      });

    expect((await preflight(WEB_ORIGIN)).headers.get("access-control-allow-origin")).toBe(
      WEB_ORIGIN,
    );
    expect((await preflight("https://evil.test")).headers.get("access-control-allow-origin")).toBe(
      null,
    );
  });
});
