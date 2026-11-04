import { memorySink } from "@sbi/analytics";
import { describe, expect, it } from "vitest";
import { createWebTracker, type WebTrackerOptions } from "./track";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

function setup(overrides: Partial<WebTrackerOptions> = {}, storage = memoryStorage()) {
  const sink = memorySink();
  const visits: string[] = [];
  const web = createWebTracker({
    token: "token",
    sink: (_token, visitId) => {
      visits.push(visitId());
      return sink;
    },
    consented: () => true,
    cookie: () => "",
    storage: () => storage,
    path: () => "/lesson",
    lang: () => "es",
    navigator: () => ({ hardwareConcurrency: 8, deviceMemory: 8 }),
    ...overrides,
  });
  return { ...web, sink, visits, storage };
}

describe("createWebTracker", () => {
  it("sends with the route, language and coarse device, and one ID for the visit", () => {
    const { track, sink, visits, storage } = setup();
    track("capture_started", { source: "camera" });
    track("capture_started", { source: "upload" });

    expect(sink.events).toHaveLength(2);
    expect(sink.events[0]?.props).toEqual({
      consentVersion: "consent-2",
      route: "lesson",
      locale: "es",
      ageBand: "general",
      deviceTier: "high",
      source: "camera",
    });
    expect(visits).toHaveLength(1);
    expect(storage.data.get("sbi.visit")).toBe(visits[0]);
  });

  it("sends nothing without consent or without a token", () => {
    const declined = setup({ consented: () => false });
    declined.track("capture_started", { source: "camera" });
    expect(declined.sink.events).toEqual([]);

    const off = setup({ token: null });
    off.track("capture_started", { source: "camera" });
    expect(off.sink.events).toEqual([]);
  });

  it("sends nothing for under-13s, by pathway or by the child band", () => {
    const pathway = setup({ cookie: () => "sbi_locale=en; sbi_pathway=child" });
    pathway.track("capture_started", { source: "camera" });
    expect(pathway.sink.events).toEqual([]);

    const band = setup(
      {},
      memoryStorage({ "sbi.lesson-prefs": JSON.stringify({ depth: "quick", age: "child" }) }),
    );
    band.track("capture_started", { source: "camera" });
    expect(band.sink.events).toEqual([]);
  });

  it("forgets the visit when usage statistics are declined", () => {
    const { track, forgetVisit, storage, visits } = setup();
    track("capture_started", { source: "camera" });
    forgetVisit();
    expect(storage.data.has("sbi.visit")).toBe(false);
    track("capture_started", { source: "camera" });
    expect(visits).toHaveLength(2);
    expect(visits[0]).not.toBe(visits[1]);
  });
});
