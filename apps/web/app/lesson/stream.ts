import {
  API_ROUTES,
  ApiError,
  Lesson,
  LessonProgress,
  LessonRequest,
  LessonSources,
  LessonVisuals,
  PolicyResponse,
  QuickAnswer,
} from "@sbi/contracts";
import { ApiRequestError, UNREACHABLE } from "../api-client";

export type LessonEvent =
  | { type: "policy"; data: PolicyResponse }
  | { type: "progress"; data: LessonProgress }
  | { type: "quick-answer"; data: QuickAnswer }
  | { type: "lesson"; data: Lesson }
  | { type: "sources"; data: LessonSources }
  | { type: "visuals"; data: LessonVisuals };

const PARSERS = {
  policy: PolicyResponse,
  progress: LessonProgress,
  "quick-answer": QuickAnswer,
  lesson: Lesson,
  sources: LessonSources,
  visuals: LessonVisuals,
} as const;

export const UNREADABLE = "The lesson arrived in a form we could not read. Try again.";

function toEvent(frame: string): LessonEvent | { type: "error"; error: string } | undefined {
  let type = "message";
  const data: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) type = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (data.length === 0) return undefined;
  let payload: unknown;
  try {
    payload = JSON.parse(data.join("\n"));
  } catch {
    throw new ApiRequestError(UNREADABLE, 200);
  }
  if (type === "error") {
    const error = ApiError.safeParse(payload);
    return { type: "error", error: error.success ? error.data.error : UNREADABLE };
  }
  if (!(type in PARSERS)) return undefined;
  const parsed = PARSERS[type as keyof typeof PARSERS].safeParse(payload);
  if (!parsed.success) throw new ApiRequestError(UNREADABLE, 200);
  return { type, data: parsed.data } as LessonEvent;
}

/** Streams a lesson, calling `onEvent` as each checked part arrives; rejects with ApiRequestError. */
export async function streamLesson(
  baseUrl: string,
  request: LessonRequest,
  onEvent: (event: LessonEvent) => void,
  options: { signal?: AbortSignal; fetcher?: typeof fetch } = {},
): Promise<void> {
  const fetcher = options.fetcher ?? fetch;
  const body = LessonRequest.parse(request);
  let response: Response;
  try {
    response = await fetcher(`${baseUrl.replace(/\/+$/, "")}${API_ROUTES.requestLesson.path}`, {
      body: JSON.stringify(body),
      // The session goes too, so a signed-in learner can get back their own saved lessons (#342).
      credentials: "include",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      method: "POST",
      signal: options.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiRequestError(UNREACHABLE, 0);
  }
  // Failures before the first event arrive as ordinary JSON errors.
  if (!response.ok || !response.body) {
    const error = ApiError.safeParse(await response.json().catch(() => null));
    throw new ApiRequestError(error.success ? error.data.error : UNREACHABLE, response.status);
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    // Normalised over the whole buffer, so a CRLF split across two chunks still joins up.
    buffer = (buffer + (value ?? "")).replace(/\r\n/g, "\n");
    const frames = buffer.split("\n\n");
    buffer = done ? "" : (frames.pop() ?? "");
    for (const frame of frames) {
      // A stream cancelled mid-chunk must not hand its buffered events to whoever started next.
      if (options.signal?.aborted) return;
      const event = toEvent(frame);
      if (event?.type === "error") throw new ApiRequestError(event.error, response.status);
      if (event) onEvent(event);
    }
    if (done) return;
  }
}
