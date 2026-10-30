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

  it("names no lesson without a valid object id", () => {
    expect(lessonRequestFrom({})).toBeUndefined();
    expect(lessonRequestFrom({ taxonomyId: "not a valid id!" })).toBeUndefined();
  });
});

describe("lessonHref", () => {
  it("round-trips through the search params", () => {
    const href = lessonHref("object.bicycle", "Bicycle: chain");
    const params = Object.fromEntries(new URL(href, "http://web.test").searchParams);
    expect(lessonRequestFrom(params)?.question).toBe(defaultQuestion("Bicycle: chain"));
  });
});
