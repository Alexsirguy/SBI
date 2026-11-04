import { API_ROUTES, Lesson, LessonRequest, LessonSources, PolicyResponse } from "@sbi/contracts";
import type { SeedPrompt } from "./dataset";

export interface ServedLesson {
  lesson?: Lesson;
  sources?: LessonSources;
  policy?: PolicyResponse;
  error?: string;
  ms: number;
}

/** The request a learner's app would send for this prompt, always asking for a fresh lesson. */
export function requestFor(prompt: SeedPrompt): LessonRequest {
  return LessonRequest.parse({
    question: prompt.question,
    ...(prompt.taxonomyId?.startsWith("object.")
      ? { taxonomyId: prompt.taxonomyId }
      : { subject: prompt.label }),
    audience: prompt.audience,
    readingLevel: prompt.audience === "child" ? "simple" : "plain",
    locale: "en",
    safetyClass: "low",
    // Reuse would score an older lesson; the benchmark measures what the pipeline writes now.
    fresh: true,
  });
}

/** Asks a running API for a lesson over its own stream, exactly as the web app does. */
export async function fetchLesson(
  apiUrl: string,
  request: LessonRequest,
  fetcher: typeof fetch = fetch,
): Promise<ServedLesson> {
  const started = Date.now();
  const response = await fetcher(`${apiUrl.replace(/\/+$/, "")}${API_ROUTES.requestLesson.path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify(request),
  });
  if (!response.ok || !response.body) {
    return { error: `HTTP ${response.status}`, ms: Date.now() - started };
  }
  const served: ServedLesson = { ms: 0 };
  const text = await response.text();
  for (const frame of text.split("\n\n")) {
    let type = "message";
    const data: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) type = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (data.length === 0) continue;
    const payload: unknown = JSON.parse(data.join("\n"));
    if (type === "lesson") served.lesson = Lesson.parse(payload);
    else if (type === "sources") served.sources = LessonSources.parse(payload);
    else if (type === "policy") served.policy = PolicyResponse.parse(payload);
    else if (type === "error") served.error = (payload as { error?: string }).error ?? "error";
  }
  served.ms = Date.now() - started;
  return served;
}
