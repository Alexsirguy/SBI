import { SupportMap, TaxonomySearchResults } from "@sbi/contracts";
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

  it("publishes the curated catalogue and on-demand counts, never which subjects", async () => {
    test = await startTestApp();

    const map = SupportMap.parse(await (await fetch(`${test.url}/taxonomy/support-map`)).json());

    expect(map.onDemandSubjects).toBe(2);
    expect(map.catalogueObjects).toBe(map.categories.flatMap((item) => item.objects).length);
    const objects = map.categories.flatMap((item) => item.objects);
    expect(objects.find((item) => item.id === "object.mushroom")).toMatchObject({
      safetyNotice: true,
    });
    expect(objects.find((item) => item.id === "object.bicycle")).toMatchObject({
      curated: true,
      safetyNotice: false,
    });
    expect(JSON.stringify(map)).not.toContain("hovercraft");
  });

  it("names the catalogue in Spanish when asked", async () => {
    test = await startTestApp();
    const map = SupportMap.parse(
      await (await fetch(`${test.url}/taxonomy/support-map?locale=es`)).json(),
    );
    expect(map.categories.flatMap((item) => item.objects).map((item) => item.label)).toContain(
      "Bicicleta",
    );
  });
});
