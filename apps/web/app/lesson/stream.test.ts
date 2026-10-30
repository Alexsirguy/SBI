import type { LessonRequest } from "@sbi/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiRequestError, UNREACHABLE } from "../api-client";
import { SAMPLE_ANSWER, SAMPLE_LESSON, sseFrames } from "./sample-lesson";
import { streamLesson, type LessonEvent } from "./stream";

const REQUEST: LessonRequest = {
  question: "Why does a magnifying glass make things look bigger?",
  taxonomyId: "object.magnifying-glass",
  audience: "teen",
  readingLevel: "plain",
  locale: "en",
  safetyClass: "low",
  assumptions: [],
  fresh: false,
};

// Splits the body into small chunks, so frames cross chunk boundaries as they do on a real network.
function streaming(body: string, status = 200) {
  const bytes = new TextEncoder().encode(body);
  return vi.fn<typeof fetch>(
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            for (let at = 0; at < bytes.length; at += 37) {
              controller.enqueue(bytes.slice(at, at + 37));
            }
            controller.close();
          },
        }),
        { status, headers: { "content-type": "text/event-stream" } },
      ),
  );
}

async function collect(fetcher: typeof fetch): Promise<LessonEvent[]> {
  const events: LessonEvent[] = [];
  await streamLesson("http://api.test/", REQUEST, (event) => events.push(event), { fetcher });
  return events;
}

describe("streamLesson", () => {
  it("posts the request and hands over each checked event in order", async () => {
    const fetcher = streaming(
      sseFrames([
        { type: "progress", data: { stage: "researching", message: "Researching 3 questions." } },
        { type: "quick-answer", data: SAMPLE_ANSWER },
        { type: "lesson", data: SAMPLE_LESSON },
        { type: "visuals", data: { lessonId: SAMPLE_LESSON.lessonId, visuals: [] } },
      ]),
    );
    const events = await collect(fetcher);
    expect(events.map((event) => event.type)).toEqual([
      "progress",
      "quick-answer",
      "lesson",
      "visuals",
    ]);
    expect(events[2]).toEqual({ type: "lesson", data: SAMPLE_LESSON });
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("http://api.test/lessons");
    expect(init).toMatchObject({ method: "POST" });
  });

  it("raises a mid-stream error after the events before it", async () => {
    const events: LessonEvent[] = [];
    const fetcher = streaming(
      sseFrames([
        { type: "quick-answer", data: SAMPLE_ANSWER },
        { type: "error", data: { error: "A reviewer needs to check this lesson." } },
      ]),
    );
    await expect(
      streamLesson("http://api.test", REQUEST, (event) => events.push(event), { fetcher }),
    ).rejects.toThrow("A reviewer needs to check this lesson.");
    expect(events.map((event) => event.type)).toEqual(["quick-answer"]);
  });

  it("reports errors that arrive before the stream, and an unreachable service", async () => {
    const notFound = vi.fn<typeof fetch>(async () =>
      Response.json({ error: "Unknown category." }, { status: 404 }),
    );
    await expect(collect(notFound)).rejects.toEqual(new ApiRequestError("Unknown category.", 404));
    const offline = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(collect(offline)).rejects.toEqual(new ApiRequestError(UNREACHABLE, 0));
  });

  it("refuses an event that does not match its contract", async () => {
    const fetcher = streaming(sseFrames([{ type: "lesson", data: { title: "No" } }]));
    await expect(collect(fetcher)).rejects.toBeInstanceOf(ApiRequestError);
  });

  it("joins a CRLF pair split across two chunks, so the next event is not swallowed", async () => {
    const body = sseFrames([
      { type: "quick-answer", data: SAMPLE_ANSWER },
      { type: "lesson", data: SAMPLE_LESSON },
    ]).replace(/\n/g, "\r\n");
    // Cut inside the blank line between the two events: "\r\n\r" | "\n".
    const cut = body.indexOf("\r\n\r\n") + 3;
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              const bytes = new TextEncoder();
              controller.enqueue(bytes.encode(body.slice(0, cut)));
              controller.enqueue(bytes.encode(body.slice(cut)));
              controller.close();
            },
          }),
        ),
    );
    expect((await collect(fetcher)).map((event) => event.type)).toEqual(["quick-answer", "lesson"]);
  });

  it("calls a frame with broken JSON unreadable, not a lost connection", async () => {
    const fetcher = streaming("event: lesson\ndata: {not json\n\n");
    await expect(collect(fetcher)).rejects.toThrow("could not read");
  });

  it("hands over nothing more once the request is cancelled mid-chunk", async () => {
    const controller = new AbortController();
    const events: LessonEvent[] = [];
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
          sseFrames([
            { type: "quick-answer", data: SAMPLE_ANSWER },
            { type: "lesson", data: SAMPLE_LESSON },
          ]),
        ),
    );
    await streamLesson(
      "http://api.test",
      REQUEST,
      (event) => {
        events.push(event);
        controller.abort();
      },
      { fetcher, signal: controller.signal },
    );
    expect(events.map((event) => event.type)).toEqual(["quick-answer"]);
  });
});
