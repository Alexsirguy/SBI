import { describe, expect, it } from "vitest";
import { Lesson, type Lesson as LessonType } from "@sbi/contracts";
import { buildIntentSignature, type IntentInput } from "./intent";
import { createReuseMatcher, type ReuseAudit, type ReuseQuery } from "./reuse";
import type { LessonRepository } from "./lesson-repository";

const CLAIM = "123e4567-e89b-12d3-a456-426614174000";
const SOURCE = "123e4567-e89b-12d3-a456-426614174002";
const SNAPSHOT = "123e4567-e89b-12d3-a456-426614174003";
const LESSON_ID = "123e4567-e89b-12d3-a456-426614174010";

const intent: IntentInput = {
  question: "Why does my kettle click off?",
  taxonomyId: "home.kettle",
  conceptIds: ["thermostat"],
  audience: "general",
  readingLevel: "plain",
  locale: "en-GB",
  safetyScope: "low",
};

function makeLesson(overrides: Partial<LessonType> = {}): LessonType {
  return Lesson.parse({
    lessonId: LESSON_ID,
    version: 1,
    taxonomyId: "home.kettle",
    title: "Why kettles click off",
    locale: "en-GB",
    audience: ["general"],
    readingLevel: "plain",
    summary: "A thermostat snaps the kettle off.",
    learningObjectives: ["Explain the click"],
    assumptions: ["sea level"],
    concepts: [{ conceptId: "thermostat", label: "Thermostat", prerequisites: [] }],
    misconceptionNotes: [],
    sections: [
      {
        sectionId: "short-answer-1",
        module: "short-answer",
        text: "Heat snaps a thermostat.",
        claimIds: [CLAIM],
      },
      {
        sectionId: "what-youre-seeing-2",
        module: "what-youre-seeing",
        text: "The switch flips.",
        claimIds: [CLAIM],
      },
      {
        sectionId: "first-principles-3",
        module: "first-principles",
        text: "Metals expand.",
        claimIds: [CLAIM],
      },
    ],
    claims: [
      {
        claimId: CLAIM,
        text: "Bimetallic thermostats snap open when hot.",
        status: "supported",
        sourceIds: [SOURCE],
        scope: "textbook",
        confidence: "high",
        dependsOn: [],
      },
    ],
    visuals: [],
    safetyClass: "low",
    reviewStatus: "auto-validated",
    reuse: {
      intentSignature: buildIntentSignature(intent),
      matchDimensions: ["intent", "depth", "locale", "assumptions", "safety"],
      cacheScope: "private",
      generatedAt: "2026-10-29T00:00:00.000Z",
      evidenceSnapshotId: SNAPSHOT,
      sourceFreshness: "fresh",
      modelVersion: "stub-1",
      promptVersion: "lesson-draft@1",
      policyVersion: "safety-1",
      reuseCount: 0,
      contentHash: "a".repeat(64),
    },
    ...overrides,
  });
}

function memoryRepository(stored: LessonType[] = []) {
  const lessons = [...stored];
  const lookups: string[] = [];
  const saved: LessonType[] = [];
  const repo: LessonRepository = {
    async save(lesson) {
      saved.push(lesson);
    },
    async get(lessonId, version) {
      return lessons.find((lesson) => lesson.lessonId === lessonId && lesson.version === version);
    },
    async latest(lessonId) {
      return lessons.filter((lesson) => lesson.lessonId === lessonId).at(-1);
    },
    async findByIntent(signature) {
      lookups.push(signature);
      return lessons.filter((lesson) => lesson.reuse.intentSignature === signature);
    },
    async findByClaimIds(claimIds) {
      return lessons.filter((lesson) =>
        lesson.claims.some((claim) => claimIds.includes(claim.claimId)),
      );
    },
  };
  return { repo, lookups, saved };
}

const query: ReuseQuery = {
  intent,
  assumptions: ["sea level"],
  policyVersion: "safety-1",
  scope: "private",
};

describe("createReuseMatcher", () => {
  it("skips the cache on a fresh-answer override", async () => {
    const { repo, lookups } = memoryRepository([makeLesson()]);

    expect(await createReuseMatcher(repo).match({ ...query, fresh: true })).toBeNull();
    expect(lookups).toHaveLength(0);
  });

  it("returns the aligned lesson, counts the hit and audits without personal data", async () => {
    const { repo, saved } = memoryRepository([makeLesson()]);
    const audits: ReuseAudit[] = [];

    const hit = await createReuseMatcher(repo, (audit) => audits.push(audit)).match(query);

    expect(hit?.lesson.reuse.reuseCount).toBe(1);
    expect(hit?.intentSignature).toBe(buildIntentSignature(intent));
    expect(hit?.matchDimensions).toEqual(["intent", "depth", "locale", "assumptions", "safety"]);
    expect(saved).toHaveLength(1);
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits[0])).not.toContain("kettle click");
  });

  it("rejects stale, refused or policy-mismatched lessons", async () => {
    const stale = makeLesson({
      reuse: { ...makeLesson().reuse, sourceFreshness: "stale" },
    });
    const refused = makeLesson({
      reviewStatus: "rejected",
      reviewedAt: "2026-10-29T00:00:00.000Z",
      reviewedBy: "reviewer",
    });
    const oldPolicy = makeLesson({
      reuse: { ...makeLesson().reuse, policyVersion: "safety-0" },
    });
    for (const lesson of [stale, refused, oldPolicy]) {
      const { repo } = memoryRepository([lesson]);
      expect(await createReuseMatcher(repo).match(query)).toBeNull();
    }
  });

  it("rejects lessons when any match dimension differs", async () => {
    const variants: ReuseQuery[] = [
      { ...query, intent: { ...intent, readingLevel: "simple" } },
      { ...query, intent: { ...intent, audience: "child" } },
      { ...query, intent: { ...intent, locale: "fr" } },
      { ...query, intent: { ...intent, safetyScope: "high" } },
      { ...query, assumptions: ["high altitude"] },
    ];
    // Same signature would collide; scope each variant to its own stored lesson.
    for (const variant of variants) {
      const stored = makeLesson({
        reuse: { ...makeLesson().reuse, intentSignature: buildIntentSignature(variant.intent) },
      });
      const { repo } = memoryRepository([stored]);
      expect(await createReuseMatcher(repo).match(variant)).toBeNull();
    }
  });

  it("serves the newest version when several align", async () => {
    const { repo } = memoryRepository([makeLesson(), makeLesson({ version: 2 })]);

    const hit = await createReuseMatcher(repo).match(query);

    expect(hit?.lesson.version).toBe(2);
  });

  it("keeps shared requests off private lessons", async () => {
    const shared = makeLesson({ reuse: { ...makeLesson().reuse, cacheScope: "shared" } });
    const { repo: privateRepo } = memoryRepository([makeLesson()]);
    expect(await createReuseMatcher(privateRepo).match({ ...query, scope: "shared" })).toBeNull();

    const { repo: sharedRepo } = memoryRepository([makeLesson(), shared]);
    expect(
      (await createReuseMatcher(sharedRepo).match({ ...query, scope: "shared" }))?.lesson.reuse
        .cacheScope,
    ).toBe("shared");
    expect(
      (await createReuseMatcher(sharedRepo).match(query))?.lesson.reuse.cacheScope,
    ).toBeDefined();
  });
});
