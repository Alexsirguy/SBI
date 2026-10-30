import { Id, LessonRequest } from "@sbi/contracts";
import { DEFAULT_PREFS, DEPTHS, type LessonPrefs, parsePrefs } from "./prefs";

export interface LessonParams {
  taxonomyId?: string;
  label?: string;
  q?: string;
  depth?: string;
  age?: string;
  /** "1" asks for a newly written lesson instead of a reused one. */
  fresh?: string;
}

/** Where "Start lesson" leads; the question defaults to the object's science. */
export function lessonHref(
  taxonomyId: string,
  label: string,
  options: { question?: string; prefs?: LessonPrefs; fresh?: boolean } = {},
): string {
  const params = new URLSearchParams({ taxonomyId, label });
  if (options.question) params.set("q", options.question);
  const prefs = options.prefs ?? DEFAULT_PREFS;
  params.set("depth", prefs.depth);
  if (prefs.age !== "none") params.set("age", prefs.age);
  if (options.fresh) params.set("fresh", "1");
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
  const prefs = parsePrefs(params.depth, params.age);
  const request = LessonRequest.safeParse({
    question: params.q?.trim() || defaultQuestion(label),
    taxonomyId: taxonomyId.data,
    audience: prefs.age === "none" ? "general" : prefs.age,
    readingLevel: DEPTHS[prefs.depth].readingLevel,
    fresh: params.fresh === "1",
    locale: "en",
    safetyClass: "low",
  });
  return request.success ? request.data : undefined;
}
