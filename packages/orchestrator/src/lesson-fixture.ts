import { Lesson } from "@sbi/contracts";
import { LESSON_DRAFT_PROMPT_VERSION } from "./draft";

export const CLAIM_A = "123e4567-e89b-12d3-a456-426614174000";
export const CLAIM_B = "123e4567-e89b-12d3-a456-426614174001";
const SOURCE = "123e4567-e89b-12d3-a456-426614174002";
const SNAPSHOT = "123e4567-e89b-12d3-a456-426614174003";
const LESSON_ID = "123e4567-e89b-12d3-a456-426614174010";

// A valid generated Merrill lesson (ADR 0017); tests override the fields under examination.
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
        sectionId: "problem-1",
        module: "problem",
        text: "Your kettle clicks off by itself. What tells it the water is hot enough?",
        claimIds: [],
      },
      {
        sectionId: "activate-2",
        module: "activate",
        text: "Think of a metal spoon left in hot tea.",
        claimIds: [],
      },
      {
        sectionId: "demonstrate-3",
        module: "demonstrate",
        text: "Heat snaps a small switch inside the kettle.",
        claimIds: [CLAIM_A],
        steps: [
          { text: "The water heats the strip.", settings: [{ controlId: "power", value: 2000 }] },
          { text: "The strip bends and the switch clicks off.", settings: [] },
        ],
      },
      {
        sectionId: "apply-4",
        module: "apply",
        text: "Metals bend as they warm and snap back as they cool.",
        claimIds: [CLAIM_B],
      },
      {
        sectionId: "integrate-5",
        module: "integrate",
        text: "Listen for the click this week. What else in your home switches off when warm?",
        claimIds: [],
      },
    ],
    tasks: [
      {
        taskId: "activate-1",
        module: "activate",
        prompt: "What makes the kettle switch off?",
        options: ["A timer", "The heat"],
        answerIndex: 1,
        feedback: ["No timer is involved.", "Yes: heat bends a strip."],
      },
      {
        taskId: "apply-2",
        module: "apply",
        prompt: "Boil the water in under two minutes.",
        options: ["More power", "Less power"],
        answerIndex: 0,
        feedback: ["Right: more power heats it faster.", "Less power heats it more slowly."],
        setup: [{ controlId: "power", value: 1000 }],
        goal: { readoutId: "boilTime", op: "atMost", value: 120 },
      },
      {
        taskId: "apply-3",
        module: "apply",
        prompt: "Make it take about four minutes.",
        options: ["About 1500 W", "About 3000 W"],
        answerIndex: 0,
        feedback: ["Yes: less power, more time.", "That boils it far too fast."],
        setup: [{ controlId: "power", value: 3000 }],
        goal: { readoutId: "boilTime", op: "near", value: 240, tolerance: 15 },
      },
    ],
    experiment: {
      controls: [{ id: "power", label: "Power", unit: "W", min: 500, max: 3000, value: 2000 }],
      readouts: [{ id: "boilTime", label: "Time to boil", unit: "s" }],
    },
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
      promptVersion: LESSON_DRAFT_PROMPT_VERSION,
      policyVersion: "safety-1",
      reuseCount: 0,
      contentHash: "a".repeat(64),
    },
    ...overrides,
  });
}
