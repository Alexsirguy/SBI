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

/** What a lesson is about: any subject by name, tied to a catalogue object when there is one. */
export interface LessonSubjectRef {
  label: string;
  taxonomyId?: string;
}

/** Where "Start lesson" leads; the question defaults to the subject's science. */
export function lessonHref(
  subject: LessonSubjectRef,
  options: { question?: string; prefs?: LessonPrefs; fresh?: boolean } = {},
): string {
  const params = new URLSearchParams({ label: subject.label });
  if (subject.taxonomyId) params.set("taxonomyId", subject.taxonomyId);
  if (options.question) params.set("q", options.question);
  const prefs = options.prefs ?? DEFAULT_PREFS;
  params.set("depth", prefs.depth);
  if (prefs.age !== "none") params.set("age", prefs.age);
  if (options.fresh) params.set("fresh", "1");
  return `/lesson?${params}`;
}

export function defaultQuestion(label: string): string {
  // Learners often type "a rainbow"; the question already supplies its own article.
  const name = label.toLowerCase().replace(/^(a|an|the)\s+/, "");
  return `What is the science behind the ${name}?`;
}

/** A valid lesson request from the page's search params, or undefined when they name nothing. */
export function lessonRequestFrom(params: LessonParams): LessonRequest | undefined {
  const taxonomyId = Id.safeParse(params.taxonomyId);
  const label = params.label?.trim();
  if (!taxonomyId.success && !label) return undefined;
  const prefs = parsePrefs(params.depth, params.age);
  const request = LessonRequest.safeParse({
    question: params.q?.trim() || defaultQuestion(label || "this object"),
    // An unknown or missing id still leaves the named subject to learn about (ADR 0013).
    ...(taxonomyId.success ? { taxonomyId: taxonomyId.data } : { subject: label }),
    audience: prefs.age === "none" ? "general" : prefs.age,
    readingLevel: DEPTHS[prefs.depth].readingLevel,
    fresh: params.fresh === "1",
    locale: "en",
    safetyClass: "low",
  });
  return request.success ? request.data : undefined;
}
