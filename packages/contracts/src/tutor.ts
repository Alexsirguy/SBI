import { z } from "zod";
import { IsoDateTime, Uuid } from "./common";
import { SafetyCategory } from "./safety";

/** The policy's categories, plus none and other, so every tutor turn records one. */
export const TurnSafetyCategory = z.enum(["none", ...SafetyCategory.options, "other"]);

export const RetentionClass = z.enum(["session", "quality-review", "research-consented"]);

export const VisualAction = z.object({
  visualId: Uuid,
  state: z.string().min(1),
});

export const TutorTurn = z
  .object({
    sessionId: Uuid,
    turnId: Uuid,
    lessonId: Uuid,
    lessonVersion: z.int().positive(),
    userText: z.string().min(1).max(2000),
    retrievedClaimIds: z.array(Uuid).default([]),
    response: z.object({
      text: z.string().min(1),
      citedClaimIds: z.array(Uuid).default([]),
      visualAction: VisualAction.optional(),
    }),
    safetyCategory: TurnSafetyCategory,
    modelVersion: z.string().min(1),
    promptVersion: z.string().min(1),
    feedback: z.enum(["helpful", "not-helpful"]).optional(),
    retentionClass: RetentionClass,
    createdAt: IsoDateTime,
  })
  .refine(
    (turn) => turn.response.citedClaimIds.every((id) => turn.retrievedClaimIds.includes(id)),
    {
      message: "Responses may only cite retrieved claims",
      path: ["response", "citedClaimIds"],
    },
  );

export type TutorTurn = z.infer<typeof TutorTurn>;
