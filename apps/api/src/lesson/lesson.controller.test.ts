import type { ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { UserFacingException } from "../common/user-facing.exception";
import { startTestApp, type TestApp, WEB_ORIGIN } from "../testing/test-app";
import { LessonController } from "./lesson.controller";
import { LessonService } from "./lesson.service";

const ANSWER = {
  type: "quick-answer",
  data: { kind: "fresh", title: "T", summary: "S", shortAnswer: "A" },
} as const;

const FULL = { type: "lesson", data: { title: "T" } } as const;
const VISUALS = { type: "visuals", data: { visuals: [] } } as const;

function mockResponse(replyHeaders: Record<string, string> = {}) {
  const chunks: string[] = [];
  const state = { status: 0, headers: {} as Record<string, string>, ended: false };
  const res = {
    getHeaders: () => replyHeaders,
    raw: {
      writeHead: (status: number, headers: Record<string, string>) => {
        state.status = status;
        state.headers = headers;
      },
      write: (chunk: string) => void chunks.push(chunk),
      end: () => void (state.ended = true),
    },
  } as unknown as { raw: ServerResponse; getHeaders: () => Record<string, string> };
  return { chunks, res, state };
}

// Signed out unless a test says otherwise; the controller only reads saved lesson ids.
const signedOut = { current: async () => undefined };
const noSaved = { list: async () => [] };
const anonymous = { headers: {}, method: "POST" };

function stubService(behavior: unknown[] | Error): LessonService {
  return {
    async *streamLesson() {
      if (behavior instanceof Error) throw behavior;
      yield* behavior;
    },
  } as unknown as LessonService;
}

function parseEvents(chunks: string[]): { type: string; data: unknown }[] {
  return chunks
    .join("")
    .split("\n\n")
    .filter(Boolean)
    .map((frame) => {
      const [type, data] = frame.split("\ndata: ");
      return { type: type?.replace("event: ", "") ?? "", data: JSON.parse(data ?? "null") };
    });
}

describe("LessonController", () => {
  it("frames the stream as SSE in arrival order", async () => {
    const controller = new LessonController(
      stubService([ANSWER, FULL, VISUALS]),
      signedOut,
      noSaved,
    );
    const { chunks, res, state } = mockResponse();

    await controller.stream({} as never, anonymous, res);

    expect(state.status).toBe(200);
    expect(state.headers["Content-Type"]).toBe("text/event-stream");
    expect(parseEvents(chunks).map((event) => event.type)).toEqual([
      "quick-answer",
      "lesson",
      "visuals",
    ]);
    expect(state.ended).toBe(true);
  });

  it("lets pre-stream failures reach the HTTP error filter", async () => {
    const failure = new UserFacingException("Try again later.", 503);
    const controller = new LessonController(stubService(failure), signedOut, noSaved);
    const { res, state } = mockResponse();

    await expect(controller.stream({} as never, anonymous, res)).rejects.toBe(failure);
    expect(state.status).toBe(0);
    expect(state.ended).toBe(false);
  });

  it("ends a broken stream with an error event", async () => {
    const controller = new LessonController(
      {
        async *streamLesson() {
          yield ANSWER;
          throw new UserFacingException("Judge timed out.", 503);
        },
      } as unknown as LessonService,
      signedOut,
      noSaved,
    );
    const { chunks, res, state } = mockResponse();

    await controller.stream({} as never, anonymous, res);

    const events = parseEvents(chunks);
    expect(events.map((event) => event.type)).toEqual(["quick-answer", "error"]);
    expect(events[1]?.data).toEqual({ error: "Judge timed out." });
    expect(state.ended).toBe(true);
  });
});

describe("lesson routes", () => {
  let test: TestApp | undefined;

  afterEach(async () => {
    await test?.app.close();
  });

  it("streams with the CORS headers browsers need, only for allowed origins", async () => {
    test = await startTestApp(undefined, undefined, undefined, (builder) =>
      builder.overrideProvider(LessonService).useValue(stubService([ANSWER, FULL, VISUALS])),
    );
    const request = (origin: string) =>
      test?.post(
        "/lessons",
        {
          question: "Why does my kettle click off?",
          taxonomyId: "object.bicycle",
          audience: "general",
          readingLevel: "plain",
          locale: "en-GB",
          safetyClass: "low",
        },
        { origin },
      );
    const allowed = await request(WEB_ORIGIN);
    expect(allowed?.headers.get("content-type")).toBe("text/event-stream");
    expect(allowed?.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
    expect(await allowed?.text()).toContain("event: lesson");
    const other = await request("https://elsewhere.example");
    expect(other?.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("answers 503 without a provider and 400 for bad bodies", async () => {
    test = await startTestApp();

    const response = await test.post("/lessons", {
      question: "Why does my kettle click off?",
      taxonomyId: "object.bicycle",
      audience: "general",
      readingLevel: "plain",
      locale: "en-GB",
      safetyClass: "low",
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: expect.any(String) });

    const bad = await test.post("/lessons", { question: "x" });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "Ask a question of at least 3 characters." });
  });

  it("adds a signed-in learner's saved lessons to reuse, and nothing when signed out", async () => {
    const seen: unknown[] = [];
    const service = {
      async *streamLesson(_body: unknown, viewer: unknown) {
        seen.push(viewer);
        yield* [ANSWER];
      },
    } as unknown as LessonService;
    const account = { accountId: "0192f1a0-0000-7000-8000-000000000001" };
    const controller = new LessonController(
      service,
      { current: async (token) => (token === "t" ? (account as never) : undefined) },
      {
        list: async () => [
          {
            lessonId: "0192f1a0-0000-7000-8000-0000000000c1",
            savedAt: new Date(),
            title: "K",
            version: 1,
          },
        ],
      },
    );

    await controller.stream(
      {} as never,
      { headers: { cookie: "sbi_session=t" }, method: "POST" },
      mockResponse().res,
    );
    await controller.stream({} as never, anonymous, mockResponse().res);

    expect(seen).toEqual([
      { ownLessonIds: new Set(["0192f1a0-0000-7000-8000-0000000000c1"]) },
      { ownLessonIds: undefined },
    ]);
  });
});
