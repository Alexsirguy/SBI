import type { AudienceBand, LessonRequest } from "@sbi/contracts";

type ReadingLevel = LessonRequest["readingLevel"];

export type Depth = "quick" | "explore" | "deeper";
/** "none" leaves the lesson for a general audience; an age band is only ever the learner's choice. */
export type AgeChoice = "none" | Exclude<AudienceBand, "general">;

export const DEPTHS: Record<Depth, { label: string; hint: string; readingLevel: ReadingLevel }> = {
  quick: { label: "Quick", hint: "Short, simple words", readingLevel: "simple" },
  explore: { label: "Explore", hint: "Everyday explanation", readingLevel: "plain" },
  deeper: { label: "Deeper", hint: "More technical detail", readingLevel: "technical" },
};

export const AGES: Record<AgeChoice, string> = {
  none: "Not set",
  child: "Child",
  teen: "Teen",
  adult: "Adult",
};

export interface LessonPrefs {
  depth: Depth;
  age: AgeChoice;
}

export const DEFAULT_PREFS: LessonPrefs = { depth: "explore", age: "none" };

export function parsePrefs(depth: unknown, age: unknown): LessonPrefs {
  return {
    depth: typeof depth === "string" && depth in DEPTHS ? (depth as Depth) : DEFAULT_PREFS.depth,
    age: typeof age === "string" && age in AGES ? (age as AgeChoice) : DEFAULT_PREFS.age,
  };
}

const KEY = "sbi.lesson-prefs";

// Session storage only: the choice lasts the visit and is never sent anywhere but the lesson URL.
export function readPrefs(storage?: Pick<Storage, "getItem">): LessonPrefs | undefined {
  try {
    const raw = (storage ?? window.sessionStorage).getItem(KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as { depth?: unknown; age?: unknown };
    return parsePrefs(value.depth, value.age);
  } catch {
    return undefined;
  }
}

export function writePrefs(prefs: LessonPrefs, storage?: Pick<Storage, "setItem">): void {
  try {
    (storage ?? window.sessionStorage).setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Private browsing can refuse storage; the URL still carries the choice.
  }
}
