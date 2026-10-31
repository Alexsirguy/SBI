import { describe, expect, it } from "vitest";
import { defaultQuestion, lessonHref, lessonRequestFrom } from "./lesson-request";

describe("lessonRequestFrom", () => {
  it("builds a request for the confirmed object, asking about its science by default", () => {
    expect(
      lessonRequestFrom({ taxonomyId: "object.electric-kettle", label: "Electric kettle" }),
    ).toMatchObject({
      taxonomyId: "object.electric-kettle",
      question: "What is the science behind the electric kettle?",
      audience: "general",
      readingLevel: "plain",
    });
    expect(
      lessonRequestFrom({
        taxonomyId: "object.electric-kettle",
        label: "Kettle",
        q: " Why does it click? ",
      })?.question,
    ).toBe("Why does it click?");
  });

  it("teaches any named subject, with or without a catalogue object", () => {
    expect(lessonRequestFrom({ label: "Rainbow" })).toMatchObject({
      subject: "Rainbow",
      question: "What is the science behind the rainbow?",
    });
    expect(lessonRequestFrom({ label: "Rainbow" })?.taxonomyId).toBeUndefined();
    expect(lessonRequestFrom({ taxonomyId: "not a valid id!", label: "Kite" })?.subject).toBe(
      "Kite",
    );
    const href = lessonHref({ label: "Camping kettle" });
    expect(href).not.toContain("taxonomyId");
    const params = Object.fromEntries(new URL(href, "http://web.test").searchParams);
    expect(lessonRequestFrom(params)?.subject).toBe("Camping kettle");
  });

  it("names no lesson when the link names nothing", () => {
    expect(lessonRequestFrom({})).toBeUndefined();
    expect(lessonRequestFrom({ taxonomyId: "not a valid id!" })).toBeUndefined();
    expect(lessonRequestFrom({ label: "  " })).toBeUndefined();
  });
});

describe("depth and age band", () => {
  it("map to the reading level and audience, never guessing an age", () => {
    const base = { taxonomyId: "object.kite", label: "Kite" };
    expect(lessonRequestFrom({ ...base, depth: "quick" })).toMatchObject({
      readingLevel: "simple",
      audience: "general",
    });
    expect(lessonRequestFrom({ ...base, depth: "deeper", age: "adult" })).toMatchObject({
      readingLevel: "technical",
      audience: "adult",
    });
  });
});

describe("fresh answers", () => {
  it("ask for a newly written lesson only when the link says so", () => {
    const base = { taxonomyId: "object.kite", label: "Kite" };
    expect(lessonRequestFrom(base)?.fresh).toBe(false);
    const href = lessonHref({ taxonomyId: "object.kite", label: "Kite" }, { fresh: true });
    const params = Object.fromEntries(new URL(href, "http://web.test").searchParams);
    expect(lessonRequestFrom(params)?.fresh).toBe(true);
  });
});

describe("lessonHref", () => {
  it("round-trips through the search params", () => {
    const href = lessonHref(
      { taxonomyId: "object.bicycle", label: "Bicycle: chain" },
      { prefs: { depth: "deeper", age: "teen" } },
    );
    const params = Object.fromEntries(new URL(href, "http://web.test").searchParams);
    expect(lessonRequestFrom(params)).toMatchObject({
      question: defaultQuestion("Bicycle: chain"),
      readingLevel: "technical",
      audience: "teen",
    });
    expect(lessonHref({ taxonomyId: "object.bicycle", label: "Bicycle" })).not.toContain("age=");
  });
});
