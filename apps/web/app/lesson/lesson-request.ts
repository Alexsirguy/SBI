import { Id, LessonRequest } from "@sbi/contracts";

export interface LessonParams {
  taxonomyId?: string;
  label?: string;
  q?: string;
}

/** Where "Start lesson" leads; the question defaults to the object's science. */
export function lessonHref(taxonomyId: string, label: string, question?: string): string {
  const params = new URLSearchParams({ taxonomyId, label });
  if (question) params.set("q", question);
  return `/lesson?${params}`;
}

export function defaultQuestion(label: string): string {
  return `What is the science behind the ${label.toLowerCase()}?`;
}

/** A valid lesson request from the page's search params, or undefined when they name no object. */
export function lessonRequestFrom(params: LessonParams): LessonRequest | undefined {
  const taxonomyId = Id.safeParse(params.taxonomyId);
  if (!taxonomyId.success) return undefined;
  const label = params.label?.trim() || "this object";
  const request = LessonRequest.safeParse({
    question: params.q?.trim() || defaultQuestion(label),
    taxonomyId: taxonomyId.data,
    audience: "general",
    readingLevel: "plain",
    locale: "en",
    safetyClass: "low",
  });
  return request.success ? request.data : undefined;
}
