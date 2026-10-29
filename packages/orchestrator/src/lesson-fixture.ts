import { Lesson } from "@sbi/contracts";

export const CLAIM_A = "123e4567-e89b-12d3-a456-426614174000";
export const CLAIM_B = "123e4567-e89b-12d3-a456-426614174001";
const SOURCE = "123e4567-e89b-12d3-a456-426614174002";
const SNAPSHOT = "123e4567-e89b-12d3-a456-426614174003";
const LESSON_ID = "123e4567-e89b-12d3-a456-426614174010";

// A valid generated lesson; tests override the fields under examination.
export function makeLesson(overrides: Record<string, unknown> = {}): Lesson {
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
        text: "Heat snaps a small switch inside the kettle.",
        claimIds: [CLAIM_A],
      },
      {
        sectionId: "what-youre-seeing-2",
        module: "what-youre-seeing",
        text: "The switch flips up with a click.",
        claimIds: [CLAIM_A],
      },
      {
        sectionId: "first-principles-3",
        module: "first-principles",
        text: "Metals bend as they warm and snap back as they cool.",
        claimIds: [CLAIM_B],
      },
    ],
    claims: [
      {
        claimId: CLAIM_A,
        text: "Bimetallic thermostats snap open when hot.",
        status: "supported",
        sourceIds: [SOURCE],
        scope: "textbook",
        confidence: "high",
        dependsOn: [],
      },
      {
        claimId: CLAIM_B,
        text: "Metals expand when heated.",
        status: "supported",
        sourceIds: [SOURCE],
        scope: "textbook",
        confidence: "high",
        dependsOn: [],
      },
    ],
    visuals: [],
    safetyClass: "low",
    reviewStatus: "generated",
    reuse: {
      intentSignature: "abc123",
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
