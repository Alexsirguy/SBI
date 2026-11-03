import { deEs, Id, LessonRequest } from "@sbi/contracts";
import type { Locale } from "../i18n/locales";
import { DEFAULT_PREFS, DEPTHS, type LessonPrefs, parsePrefs } from "./prefs";

export interface LessonParams {
  taxonomyId?: string;
  label?: string;
  q?: string;
  depth?: string;
  age?: string;
  /** "1" asks for a newly written lesson instead of a reused one. */
  fresh?: string;
  /** The page's language; the lesson is written in it (#107). */
  locale?: Locale;
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

export function defaultQuestion(label: string, locale: Locale = "en"): string {
  // Learners often type "a rainbow"; the question already supplies its own article.
  // Spanish articles carry gender we cannot guess, so the learner's own wording is kept.
  if (locale === "es") return `¿Cuál es la ciencia detrás ${deEs(label.toLowerCase())}?`;
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
    question:
      params.q?.trim() ||
      defaultQuestion(
        label || (params.locale === "es" ? "este objeto" : "this object"),
        params.locale,
      ),
    // An unknown or missing id still leaves the named subject to learn about (ADR 0013).
    ...(taxonomyId.success ? { taxonomyId: taxonomyId.data } : { subject: label }),
    audience: prefs.age === "none" ? "general" : prefs.age,
    readingLevel: DEPTHS[prefs.depth].readingLevel,
    fresh: params.fresh === "1",
    locale: params.locale ?? "en",
    safetyClass: "low",
  });
  return request.success ? request.data : undefined;
}
