import {
  Lesson,
  LessonVisuals,
  MODEL_KNOWLEDGE_NOTE,
  VisualManifest,
  type QuickAnswer,
} from "@sbi/contracts";

// A Merrill lesson (ADR 0017) and its experiment, after the contract's guitar fixture.
const LESSON_ID = "0192f1a0-0000-7000-8000-00000000a020";
export const MERRILL_VISUAL_ID = "0192f1a0-0000-7000-8000-00000000e020";
const CLAIMS = {
  tension: "0192f1a0-0000-7000-8000-00000000c020",
  length: "0192f1a0-0000-7000-8000-00000000c021",
} as const;

/** A 65 cm string weighing 3 g per metre: about 147 Hz at 110 N, as the lesson says. */
export const PITCH_FORMULA = "sqrt(tension / 0.003) / 1.3";

export const SAMPLE_MERRILL_LESSON: Lesson = Lesson.parse({
  lessonId: LESSON_ID,
  version: 1,
  taxonomyId: "object.acoustic-guitar",
  title: "Why a tighter string sounds higher",
  locale: "en",
  audience: ["general", "teen"],
  readingLevel: "plain",
  summary: "A string's pitch rises with its tension and falls with its length and weight.",
  learningObjectives: ["Predict how tension and length change a string's pitch"],
  assumptions: ["A steel string on a full-size guitar"],
  concepts: [
    { conceptId: "vibration", label: "Vibration" },
    { conceptId: "wave-speed", label: "Wave speed", prerequisites: ["vibration"] },
  ],
  misconceptionNotes: [],
  sections: [
    {
      sectionId: "problem",
      module: "problem",
      heading: "Your guitar sounds flat",
      text: "Your guitar's A string sounds lower than the tuner says. What do you change, and why does it work?",
      claimIds: [],
    },
    {
      sectionId: "activate",
      module: "activate",
      heading: "You have heard this before",
      text: "Think of a rubber band: stretch it tighter and pluck it.",
      claimIds: [],
    },
    {
      sectionId: "demonstrate",
      module: "demonstrate",
      heading: "Tension speeds up the wave",
      text: "A plucked string vibrates; how fast it vibrates is its pitch.",
      claimIds: [CLAIMS.tension],
      steps: [
        {
          text: "Start at 110 N: the string sounds about 147 Hz.",
          settings: [{ controlId: "tension", value: 110 }],
        },
        {
          text: "Tighten it to 160 N and the wave travels faster, so the pitch rises.",
          settings: [{ controlId: "tension", value: 160 }],
        },
        { text: "Halve the length instead and the pitch doubles, which is what a fret does." },
      ],
    },
    {
      sectionId: "apply",
      module: "apply",
      heading: "Tune it yourself",
      text: "Use the experiment to solve each challenge.",
      claimIds: [CLAIMS.tension],
    },
    {
      sectionId: "integrate",
      module: "integrate",
      heading: "Listen for it this week",
      text: "Press a string at the fifth fret and pluck it: you shortened it, so it sounds higher.",
      claimIds: [CLAIMS.length],
    },
  ],
  claims: [
    {
      claimId: CLAIMS.tension,
      text: "A string's frequency rises with the square root of its tension.",
      status: "unsupported",
      origin: "model",
      sourceIds: [],
      scope: "physics: vibrating strings",
      confidence: "medium",
      uncertainty: MODEL_KNOWLEDGE_NOTE,
    },
    {
      claimId: CLAIMS.length,
      text: "Halving a string's vibrating length doubles its frequency.",
      status: "unsupported",
      origin: "model",
      sourceIds: [],
      scope: "physics: vibrating strings",
      confidence: "medium",
      uncertainty: MODEL_KNOWLEDGE_NOTE,
    },
  ],
  visuals: [],
  tasks: [
    {
      taskId: "guess",
      module: "activate",
      prompt: "Which change raises the pitch?",
      options: ["Loosen the string", "Tighten the string"],
      answerIndex: 1,
      feedback: [
        "Looser strings vibrate more slowly, so they sound lower.",
        "Yes: more tension makes the wave travel faster.",
      ],
    },
    {
      taskId: "tune-up",
      module: "apply",
      prompt: "Set the tension so the string sounds at least 180 Hz.",
      options: ["Raise the tension", "Lower the tension"],
      answerIndex: 0,
      feedback: [
        "Right: pitch grows with the square root of tension.",
        "Lowering tension drops the pitch.",
      ],
      setup: [{ controlId: "tension", value: 110 }],
      goal: { readoutId: "pitch", op: "atLeast", value: 180 },
      claimIds: [CLAIMS.tension],
    },
    {
      taskId: "match",
      module: "apply",
      prompt: "Make the string sound near 147 Hz again.",
      options: ["About 110 N", "About 200 N"],
      answerIndex: 0,
      feedback: ["Yes: that is where we started.", "That is far too tight for 147 Hz."],
      setup: [{ controlId: "tension", value: 180 }],
      goal: { readoutId: "pitch", op: "near", value: 147, tolerance: 5 },
    },
  ],
  experiment: {
    controls: [{ id: "tension", label: "Tension", unit: "N", min: 40, max: 200, value: 110 }],
    readouts: [{ id: "pitch", label: "Pitch", unit: "Hz" }],
  },
  safetyClass: "low",
  reviewStatus: "auto-validated",
  reuse: {
    intentSignature: "c".repeat(64),
    matchDimensions: ["intent", "depth", "locale", "safety"],
    cacheScope: "shared",
    generatedAt: "2026-10-31T09:00:00.000Z",
    validatedAt: "2026-10-31T09:00:20.000Z",
    evidenceSnapshotId: "0192f1a0-0000-7000-8000-00000000d020",
    sourceFreshness: "fresh",
    modelVersion: "stub-1",
    promptVersion: "lesson-draft@8",
    policyVersion: "1",
    reuseCount: 0,
    contentHash: "d".repeat(64),
  },
});

/** The experiment as a graph: the string's wave, with the slider and readout the lesson names. */
export const SAMPLE_MERRILL_MANIFEST: VisualManifest = VisualManifest.parse({
  visualId: MERRILL_VISUAL_ID,
  kind: "graph",
  alt: "A guitar string's vibration, faster as the tension rises",
  fallback: { text: "Tighten the string and it vibrates faster, so it sounds higher." },
  assumptions: ["A 65 cm steel string", "No damping"],
  controls: [
    { id: "tension", label: "Tension", unit: "N", min: 40, max: 200, step: 5, value: 110 },
  ],
  readouts: [{ id: "pitch", label: "Pitch", unit: "Hz", formula: PITCH_FORMULA }],
  spec: {
    x: { name: "t", label: "Time", unit: "ms", from: 0, to: 20, samples: 200 },
    series: [
      {
        name: "displacement",
        label: "Displacement",
        formula: `sin(2 * pi * ${PITCH_FORMULA} * t / 1000)`,
      },
    ],
    vegaLite: { mark: "line" },
  },
});

export const SAMPLE_MERRILL_VISUALS: LessonVisuals = LessonVisuals.parse({
  lessonId: LESSON_ID,
  visuals: [
    {
      visualId: MERRILL_VISUAL_ID,
      kind: "graph",
      manifestUri: `/visuals?visualId=${MERRILL_VISUAL_ID}`,
      alt: SAMPLE_MERRILL_MANIFEST.alt,
    },
  ],
});

/** Sent before the lesson by the API today; the reader must not show it beside a Merrill lesson. */
export const SAMPLE_MERRILL_ANSWER: QuickAnswer = {
  kind: "fresh",
  lessonId: LESSON_ID,
  version: 1,
  shortAnswer: "Tighten the string: more tension makes it vibrate faster, so it sounds higher.",
  claimIds: [CLAIMS.tension],
  reviewStatus: "auto-validated",
};
