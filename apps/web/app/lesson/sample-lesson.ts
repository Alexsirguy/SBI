import { Lesson, MODEL_KNOWLEDGE_NOTE, type QuickAnswer } from "@sbi/contracts";

// A full lesson in the shape the API streams, for unit tests and mocked end-to-end runs.
const LESSON_ID = "0192f1a0-0000-7000-8000-00000000a001";
const SOURCE_A = "0192f1a0-0000-7000-8000-00000000b001";
const SOURCE_B = "0192f1a0-0000-7000-8000-00000000b002";
export const CLAIMS = {
  refraction: "0192f1a0-0000-7000-8000-00000000c001",
  virtualImage: "0192f1a0-0000-7000-8000-00000000c002",
  angle: "0192f1a0-0000-7000-8000-00000000c003",
  history: "0192f1a0-0000-7000-8000-00000000c004",
} as const;

export const SAMPLE_LESSON: Lesson = Lesson.parse({
  lessonId: LESSON_ID,
  version: 1,
  taxonomyId: "object.magnifying-glass",
  title: "Why a magnifying glass makes things look bigger",
  locale: "en",
  audience: ["teen"],
  readingLevel: "plain",
  summary:
    "A magnifying glass is a converging lens that makes a larger, upright image which fills more of your view.",
  learningObjectives: [
    "Describe the larger, upright image a magnifying glass makes",
    "Explain magnification as the image taking up a larger angle in the eye",
  ],
  assumptions: ["The object sits closer to the lens than its focal length"],
  concepts: [
    { conceptId: "magnification", label: "angular magnification", prerequisites: ["refraction"] },
    { conceptId: "refraction", label: "refraction", prerequisites: [] },
    { conceptId: "focal-length", label: "focal length", prerequisites: ["refraction"] },
  ],
  misconceptionNotes: [
    "The object itself does not get bigger; the lens makes a larger image for your eye.",
  ],
  sections: [
    {
      sectionId: "what-youre-seeing-1",
      module: "what-youre-seeing",
      heading: "Small print looks larger",
      text: "Hold a magnifying glass close over a word and the word looks bigger and still the right way up.",
      claimIds: [CLAIMS.virtualImage],
    },
    {
      sectionId: "short-answer-2",
      module: "short-answer",
      heading: "A bigger image fills more of your view",
      text: "The lens makes a larger, upright image of an object inside its focal length, and that image takes up a larger angle in your eye.",
      claimIds: [CLAIMS.virtualImage, CLAIMS.angle],
    },
    {
      sectionId: "first-principles-3",
      module: "first-principles",
      heading: "Glass bends light",
      text: "Light changes direction when it passes from air into glass. A curved lens bends rays so they seem to come from a larger object.",
      claimIds: [CLAIMS.refraction, CLAIMS.virtualImage],
    },
    {
      sectionId: "how-parts-work-4",
      module: "how-parts-work",
      heading: "The lens and your eye work together",
      text: "The lens bends the light, and your eye sees the image at a larger angle than the object alone.",
      claimIds: [CLAIMS.angle],
    },
    {
      sectionId: "try-an-idea-5",
      module: "try-an-idea",
      heading: "Move the glass slowly",
      text: "Look at a printed word and slowly lift the glass away. Notice when the word stops looking clear.",
      claimIds: [CLAIMS.virtualImage],
    },
    {
      sectionId: "history-6",
      module: "history",
      heading: "Reading stones",
      text: "People used polished glass and crystal to help them read small text long before modern lenses.",
      claimIds: [CLAIMS.history],
    },
    {
      sectionId: "check-thinking-7",
      module: "check-thinking",
      heading: "Does the word grow?",
      text: "A friend says the glass makes the letters themselves bigger. What would you tell them?",
      claimIds: [],
    },
    {
      sectionId: "go-further-8",
      module: "go-further",
      heading: "Angles, not sizes",
      text: "Magnification compares the angle the image makes in your eye with the angle the object makes without the lens.",
      claimIds: [CLAIMS.angle],
    },
  ],
  claims: [
    {
      claimId: CLAIMS.refraction,
      text: "Refraction is the change in a light ray's direction as it passes between substances.",
      status: "supported",
      sourceIds: [SOURCE_A, SOURCE_B],
      scope: "physics: refraction",
      confidence: "high",
      citations: [
        { sourceId: SOURCE_A, excerptId: "x1" },
        { sourceId: SOURCE_B, excerptId: "x1" },
      ],
    },
    {
      claimId: CLAIMS.virtualImage,
      text: "An object inside a convex lens's focal length forms a virtual, upright, larger image.",
      status: "qualified",
      sourceIds: [SOURCE_A],
      scope: "physics: magnifiers",
      confidence: "medium",
      uncertainty: "Only one independent source supports this so far.",
      citations: [{ sourceId: SOURCE_A, excerptId: "x2" }],
    },
    {
      claimId: CLAIMS.angle,
      text: "The image looks larger because it subtends a larger angle in the eye than the object does.",
      status: "disputed",
      sourceIds: [SOURCE_A],
      scope: "physics: magnifiers",
      confidence: "medium",
      uncertainty: "Trusted sources disagree on this.",
      citations: [{ sourceId: SOURCE_A, excerptId: "x3" }],
    },
    {
      claimId: CLAIMS.history,
      text: "Polished stones and glass were used as reading aids before modern spectacles.",
      status: "unsupported",
      origin: "model",
      sourceIds: [],
      scope: "general knowledge: history of the magnifying glass",
      confidence: "low",
      uncertainty: MODEL_KNOWLEDGE_NOTE,
    },
  ],
  visuals: [],
  safetyClass: "low",
  reviewStatus: "needs-review",
  reuse: {
    intentSignature: "a".repeat(64),
    matchDimensions: ["intent", "depth", "locale", "assumptions", "safety"],
    cacheScope: "private",
    generatedAt: "2026-10-30T09:00:00.000Z",
    validatedAt: "2026-10-30T09:00:20.000Z",
    evidenceSnapshotId: "0192f1a0-0000-7000-8000-00000000d001",
    sourceFreshness: "fresh",
    modelVersion: "stub-1",
    promptVersion: "lesson-draft@6",
    policyVersion: "1",
    reuseCount: 0,
    contentHash: "b".repeat(64),
  },
  disclaimers: [
    {
      kind: "model-knowledge",
      message:
        "Parts of this lesson come from the AI's general knowledge because no trusted source was found for them, and no reviewer has checked it yet. Report anything that looks wrong.",
      sectionIds: [],
    },
  ],
});

export const SAMPLE_ANSWER: QuickAnswer = {
  kind: "fresh",
  lessonId: LESSON_ID,
  version: 1,
  shortAnswer:
    "A magnifying glass makes a larger, upright image of anything inside its focal length, and that image fills more of your view.",
  claimIds: [CLAIMS.virtualImage, CLAIMS.angle],
  reviewStatus: "auto-validated",
};

/** Frames exactly as the API writes them. */
export function sseFrames(events: { type: string; data: unknown }[]): string {
  return events
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`)
    .join("");
}
