import type { Lesson } from "@sbi/contracts";
import { buildIntentSignature, type IntentInput } from "./intent";
import { isReusable } from "./invalidation";
import type { LessonRepository } from "./lesson-repository";

export interface ReuseQuery {
  intent: IntentInput;
  assumptions: string[];
  /** Lessons generated under another policy are never served. */
  policyVersion: string;
  scope: "private" | "shared";
  /** 'Get a fresh answer': skip the cache entirely. */
  fresh?: boolean;
}

export interface ReuseHit {
  lesson: Lesson;
  intentSignature: string;
  matchDimensions: string[];
}

// Hashes, ids and dimensions only: safe to log anywhere, never personal data.
export interface ReuseAudit {
  intentSignature: string;
  lessonId: string;
  lessonVersion: number;
  matchedAt: string;
  matchDimensions: string[];
  cacheScope: "private" | "shared";
}

export type ReuseAuditSink = (audit: ReuseAudit) => void;

export interface ReuseMatcher {
  match(query: ReuseQuery): Promise<ReuseHit | null>;
}

function sameSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const remaining = new Set(left);
  for (const item of right) {
    if (!remaining.delete(item)) return false;
  }
  return true;
}

function depthMatches(lesson: Lesson, intent: IntentInput): boolean {
  return (
    lesson.readingLevel === intent.readingLevel &&
    lesson.audience.length === 1 &&
    lesson.audience[0] === intent.audience
  );
}

// Claim, source and asset changes flow through the lesson invalidator, which
// marks lessons stale; the freshness filter below is what keeps them unserved.
export function createReuseMatcher(
  lessons: LessonRepository,
  onAudit?: ReuseAuditSink,
): ReuseMatcher {
  return {
    async match(query: ReuseQuery): Promise<ReuseHit | null> {
      if (query.fresh) return null;
      const intentSignature = buildIntentSignature(query.intent);
      const assumptions = [...new Set(query.assumptions.map((item) => item.trim()))].sort();
      const candidates = await lessons.findByIntent(intentSignature);
      const hit = candidates
        .filter((lesson) => isReusable(lesson))
        .filter((lesson) => lesson.reuse.policyVersion === query.policyVersion)
        .filter((lesson) => lesson.reuse.cacheScope === "shared" || query.scope === "private")
        .filter((lesson) => depthMatches(lesson, query.intent))
        .filter((lesson) => lesson.locale === query.intent.locale)
        .filter((lesson) => sameSet([...lesson.assumptions].sort(), assumptions))
        .filter((lesson) => lesson.safetyClass === query.intent.safetyScope)
        .sort((left, right) => right.version - left.version)
        .at(0);
      if (!hit) return null;
      const lesson: Lesson = {
        ...hit,
        reuse: { ...hit.reuse, reuseCount: hit.reuse.reuseCount + 1 },
      };
      await lessons.save(lesson);
      onAudit?.({
        intentSignature,
        lessonId: lesson.lessonId,
        lessonVersion: lesson.version,
        matchedAt: new Date().toISOString(),
        matchDimensions: [...lesson.reuse.matchDimensions],
        cacheScope: lesson.reuse.cacheScope,
      });
      return { lesson, intentSignature, matchDimensions: [...lesson.reuse.matchDimensions] };
    },
  };
}
