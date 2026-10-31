import { z } from "zod";
import { Id, IsoDateTime, Sha256, Uuid } from "./common";

// Learners see qualitative certainty only; the calibrated number stays internal.
export const Certainty = z.enum(["likely", "possible", "unsure"]);

export const RecognitionCandidate = z.object({
  taxonomyId: Id,
  label: z.string().min(1),
  certainty: Certainty,
  calibratedConfidence: z.number().min(0).max(1),
  reasons: z.array(z.string().min(1)).default([]),
});

export const UserCorrection = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("selected-alternative"), taxonomyId: Id }),
  z.object({ kind: z.literal("free-text"), text: z.string().min(1).max(200) }),
]);

export const RecognitionResult = z
  .object({
    resultId: Uuid,
    sessionId: Uuid,
    imageSha256: Sha256,
    provider: z.string().min(1),
    model: z.string().min(1),
    modelVersion: z.string().min(1),
    calibrationVersion: z.string().min(1),
    candidates: z.array(RecognitionCandidate),
    observations: z.array(z.string().min(1)).default([]),
    /** The model's own names, catalogued or not, strongest first; a repeat photo reuses them.
        Absent on results stored before labels were kept, which are asked again rather than reused. */
    labels: z
      .array(z.object({ label: z.string().min(1).max(60), certainty: Certainty }))
      .max(5)
      .optional(),
    selectedTaxonomyId: Id.optional(),
    userCorrection: UserCorrection.optional(),
    createdAt: IsoDateTime,
    deleteBy: IsoDateTime,
  })
  .superRefine((result, ctx) => {
    const candidateIds = result.candidates.map((candidate) => candidate.taxonomyId);
    if (result.selectedTaxonomyId && !candidateIds.includes(result.selectedTaxonomyId)) {
      const corrected =
        result.userCorrection?.kind === "selected-alternative" &&
        result.userCorrection.taxonomyId === result.selectedTaxonomyId;
      if (!corrected) {
        ctx.addIssue({
          code: "custom",
          message: "Selected category must be a candidate or a user correction",
          path: ["selectedTaxonomyId"],
        });
      }
    }
    if (Date.parse(result.deleteBy) <= Date.parse(result.createdAt)) {
      ctx.addIssue({
        code: "custom",
        message: "deleteBy must be after createdAt",
        path: ["deleteBy"],
      });
    }
  });

export type Certainty = z.infer<typeof Certainty>;
export type RecognitionResult = z.infer<typeof RecognitionResult>;
