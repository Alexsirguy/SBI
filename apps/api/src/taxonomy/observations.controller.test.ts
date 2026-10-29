import { ObservationMatches } from "@sbi/contracts";
import { afterEach, describe, expect, it } from "vitest";
import {
  fakeGaps,
  fakeMedia,
  fakeRecognition,
  startTestApp,
  type TestApp,
} from "../testing/test-app";

describe("observation route", () => {
  let test: TestApp | undefined;

  afterEach(async () => {
    await test?.app.close();
  });

  it("matches what the learner noticed and records no gap when something fits", async () => {
    const gaps = fakeGaps();
    test = await startTestApp(fakeMedia(), fakeRecognition(), gaps);

    const response = await test.post("/observations", { shape: "two wheels", use: "I ride it" });

    expect(ObservationMatches.parse(await response.json()).results[0]).toEqual({
      label: "Bicycle",
      taxonomyId: "object.bicycle",
    });
    expect(gaps.recorded).toEqual([]);
  });

  it("records a normalised gap, without digits, when nothing fits", async () => {
    const gaps = fakeGaps();
    test = await startTestApp(fakeMedia(), fakeRecognition(), gaps);

    const response = await test.post("/observations", {
      guess: "My Penny-Farthing from 1885",
      material: "brass",
    });

    expect(await response.json()).toEqual({ results: [] });
    expect(gaps.recorded).toEqual([{ source: "observation", term: "penny farthing" }]);
  });

  it("still answers when the gap cannot be stored", async () => {
    const gaps = fakeGaps();
    gaps.repository.record = async () => {
      throw new Error("database down");
    };
    test = await startTestApp(fakeMedia(), fakeRecognition(), gaps);

    const response = await test.post("/observations", { guess: "lava lamp" });

    expect(response.status).toBe(200);
  });

  it("rejects an empty form", async () => {
    test = await startTestApp();

    const response = await test.post("/observations", { shape: " " });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Tell us at least one thing you notice." });
  });
});
