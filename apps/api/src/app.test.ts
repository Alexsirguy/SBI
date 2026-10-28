import { afterEach, describe, expect, it } from "vitest";
import { startTestApp, type TestApp } from "./testing/test-app";

describe("api app", () => {
  let test: TestApp | undefined;

  afterEach(async () => {
    await test?.app.close();
  });

  it("reports healthy", async () => {
    test = await startTestApp();

    const response = await fetch(`${test.url}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("answers unknown routes and unreadable bodies in the error contract", async () => {
    test = await startTestApp();

    const missing = await test.post("/nope", {});
    expect(missing.status).toBe(404);
    expect(await missing.json()).toHaveProperty("error");

    const broken = await test.post("/uploads", "{");
    expect(broken.status).toBe(400);
    expect(await broken.json()).toEqual({ error: "The request could not be read." });
  });
});
