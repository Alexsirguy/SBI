import { z } from "zod";
import { Id, Uuid } from "./common";
import { PhotoKey } from "./media-api";
import { Certainty, RecognitionCandidate } from "./recognition";
import { TaxonomyMatch } from "./taxonomy-api";

export const RecognisePhotoRequest = z.object({
  key: PhotoKey,
  /** Groups a learner's results until accounts exist; the API issues one when absent. */
  sessionId: Uuid.optional(),
});

// The calibrated number stays server-side; learners see only the band and the reasons.
export const LearnerCandidate = RecognitionCandidate.omit({ calibratedConfidence: true }).extend({
  /** Parts the learner can tap when the photo shows only part of the object. */
  parts: z.array(TaxonomyMatch).default([]),
});

export const CategoryFallback = z.object({
  taxonomyId: Id,
  label: z.string().min(1),
  alternatives: z.array(z.string().min(1)).min(2),
  assumption: z.string().min(1),
});

export const NextStep = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("proceed"), taxonomyId: Id }),
  z.object({
    kind: z.literal("ask"),
    question: z.string().min(1),
    options: z.array(TaxonomyMatch).min(1).max(3),
    fallback: CategoryFallback.optional(),
  }),
  z.object({ kind: z.literal("assume-category"), fallback: CategoryFallback }),
  z.object({ kind: z.literal("describe") }),
]);

export const RecognisedPhoto = z.object({
  resultId: Uuid,
  sessionId: Uuid,
  candidates: z.array(LearnerCandidate).max(3),
  /** Look-alikes the model named that the catalog cannot teach yet; picking one is a correction. */
  otherLabels: z.array(z.string().min(1).max(60)).max(3).default([]),
  /** What it could be, in the model's own words and strongest first; any can start a lesson. */
  options: z
    .array(z.object({ label: z.string().min(1).max(60), certainty: Certainty }))
    .max(3)
    .default([]),
  next: NextStep,
});

export const RecordSelectionRequest = z.object({
  resultId: Uuid,
  selection: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("object"), taxonomyId: Id }),
    z.object({ kind: z.literal("free-text"), text: z.string().trim().min(1).max(200) }),
  ]),
});

export const RecordedSelection = z.object({ recorded: z.literal(true) });

export type LearnerCandidate = z.output<typeof LearnerCandidate>;
export type NextStep = z.infer<typeof NextStep>;
