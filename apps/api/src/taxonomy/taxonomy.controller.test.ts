import { TaxonomySearchResults } from "@sbi/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { startTestApp, WEB_ORIGIN, type TestApp } from "../testing/test-app";

describe("taxonomy routes", () => {
  let test: TestApp | undefined;

  afterEach(async () => {
    await test?.app.close();
  });

  it("finds objects by alias and keyword, matching the contract", async () => {
    test = await startTestApp();

    const response = await fetch(`${test.url}/taxonomy/search?q=bike`, {
      headers: { origin: WEB_ORIGIN },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
    expect(TaxonomySearchResults.parse(await response.json())).toEqual({
      results: [{ label: "Bicycle", taxonomyId: "object.bicycle" }],
    });
  });

  it("returns an empty list when nothing matches", async () => {
    test = await startTestApp();

    const response = await fetch(`${test.url}/taxonomy/search?q=spaceship`);

    expect(await response.json()).toEqual({ results: [] });
  });

  it("rejects missing, short and repeated queries", async () => {
    test = await startTestApp();

    for (const query of ["", "?q=b", "?q=bike&q=kettle"]) {
      const response = await fetch(`${test.url}/taxonomy/search${query}`);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Type at least 2 letters to search." });
    }
  });
});
