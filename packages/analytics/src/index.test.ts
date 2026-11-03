import { describe, expect, it } from "vitest";
import { createLogSink } from "./index";

describe("createLogSink", () => {
  it("writes one JSON line per event, holding only ids and rank", () => {
    const lines: string[] = [];
    createLogSink((line) => lines.push(line))({
      at: "2026-11-03T12:00:00.000Z",
      fromLessonId: "lesson-1",
      rank: 0,
      toTaxonomyId: "object.kettle",
      type: "next-concept",
    });
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      at: "2026-11-03T12:00:00.000Z",
      fromLessonId: "lesson-1",
      rank: 0,
      toTaxonomyId: "object.kettle",
      type: "next-concept",
    });
  });
});
