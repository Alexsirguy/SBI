import { describe, expect, it, vi } from "vitest";
import { confidenceBand, deviceTier, elapsedBucket, rangeBucket, sizeBucket } from "./buckets";
import { payloadProblems } from "./guard";
import { createMixpanelSink, MIXPANEL_EU_HOST } from "./mixpanel";
import { createTracker, memorySink } from "./tracker";
import type { EventContext } from "./browser-events";

const context: EventContext = {
  consentVersion: "consent-2",
  route: "lesson",
  locale: "en",
  ageBand: "teen",
  deviceTier: "mid",
};
const LESSON = "0192f1a0-0000-7000-8000-00000000000c";

function setup(current: EventContext | null = context) {
  const sink = memorySink();
  const rejected: { name: string; problems: string[] }[] = [];
  const track = createTracker({
    sink,
    context: () => current ?? undefined,
    onReject: (name, problems) => rejected.push({ name, problems }),
  });
  return { sink, track, rejected };
}

describe("createTracker", () => {
  it("sends a checked event with the shared context", () => {
    const { sink, track } = setup();
    expect(track("section_opened", { lessonId: LESSON, version: 2, sectionId: "mechanism" })).toBe(
      true,
    );
    expect(sink.events).toEqual([
      {
        name: "section_opened",
        props: { ...context, lessonId: LESSON, version: 2, sectionId: "mechanism" },
      },
    ]);
  });

  it("sends nothing when there is no context: no consent, or a child", () => {
    const { sink, track } = setup(null);
    expect(track("capture_started", { source: "camera" })).toBe(false);
    expect(sink.events).toEqual([]);
  });

  it("refuses properties the schema doesn't list", () => {
    const { sink, track, rejected } = setup();
    const sneaky = { source: "camera", question: "why is my nan's kettle loud" };
    expect(track("capture_started", sneaky as never)).toBe(false);
    expect(sink.events).toEqual([]);
    expect(rejected[0]?.name).toBe("capture_started");
  });

  it("refuses words where an id belongs, so typed text can't pass as one", () => {
    const { track } = setup();
    const props = { lessonId: LESSON, version: 1, sectionId: "why does my kettle click" };
    expect(track("section_opened", props)).toBe(false);
  });

  it("never sends the child band, even if asked", () => {
    const { track } = setup({ ...context, ageBand: "child" as never });
    expect(track("capture_started", { source: "camera" })).toBe(false);
  });
});

describe("payloadProblems", () => {
  it("flags text, photos and location at any depth", () => {
    expect(payloadProblems({ nested: { latitude: 51.5 } })).toEqual([
      "nested.latitude is not allowed",
    ]);
    expect(payloadProblems({ tutorText: "hi" })).toEqual(["tutorText is not allowed"]);
    expect(payloadProblems({ kind: "data:image/png;base64,AAAA" })).toEqual([
      "kind looks like encoded data",
    ]);
    expect(payloadProblems({ kind: "x".repeat(81) })).toEqual(["kind is longer than 80"]);
  });

  it("lets ids and plain values through", () => {
    expect(payloadProblems({ lessonId: LESSON, taxonomyId: "kitchen.kettle", ms: 1200 })).toEqual(
      [],
    );
  });
});

describe("buckets", () => {
  it("keeps values coarse", () => {
    expect(elapsedBucket(2500)).toBe("1-3s");
    expect(sizeBucket(2 * 1024 * 1024)).toBe("1-3MB");
    expect(confidenceBand(0.62)).toBe("medium");
    expect(confidenceBand(undefined)).toBe("none");
    expect(rangeBucket(9, 0, 10)).toBe("high");
    expect(deviceTier({ hardwareConcurrency: 2, deviceMemory: 4 })).toBe("low");
    expect(deviceTier({ hardwareConcurrency: 8, deviceMemory: 8 })).toBe("high");
    expect(deviceTier({})).toBe("mid");
  });
});

describe("createMixpanelSink", () => {
  function fakeMixpanel() {
    return { init: vi.fn(), register: vi.fn(), identify: vi.fn(), track: vi.fn(), reset: vi.fn() };
  }

  it("loads Mixpanel on the first event, in the EU, without IP, URLs or persistence", async () => {
    const mixpanel = fakeMixpanel();
    const load = vi.fn(async () => mixpanel as never);
    const sink = createMixpanelSink({ token: "t", visitId: () => "visit-1", load });
    expect(load).not.toHaveBeenCalled();

    sink.send("capture_started", { source: "camera" });
    await vi.waitFor(() => expect(mixpanel.track).toHaveBeenCalled());

    expect(mixpanel.init).toHaveBeenCalledWith(
      "t",
      expect.objectContaining({
        api_host: MIXPANEL_EU_HOST,
        ip: false,
        autocapture: false,
        track_pageview: false,
        disable_persistence: true,
        property_blacklist: expect.arrayContaining(["$current_url", "$referrer"]),
      }),
    );
    expect(mixpanel.register).toHaveBeenCalledWith({ distinct_id: "visit-1" });
    expect(mixpanel.identify).not.toHaveBeenCalled();
    expect(mixpanel.track).toHaveBeenCalledWith("capture_started", { source: "camera" });
  });

  it("forgets the visit when reset", async () => {
    const mixpanel = fakeMixpanel();
    const sink = createMixpanelSink({
      token: "t",
      visitId: () => "v",
      load: async () => mixpanel as never,
    });
    sink.send("capture_started", { source: "camera" });
    await vi.waitFor(() => expect(mixpanel.track).toHaveBeenCalled());
    sink.reset();
    await vi.waitFor(() => expect(mixpanel.reset).toHaveBeenCalled());
  });
});
