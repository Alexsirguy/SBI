import { z } from "zod";
import { IsoDateTime, Uuid } from "./common";

export const SafetyCategory = z.enum([
  "none",
  "medical",
  "chemical",
  "weapons",
  "self-harm",
  "biological",
  "other",
]);

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
    safetyCategory: SafetyCategory,
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

export type SafetyCategory = z.infer<typeof SafetyCategory>;
export type TutorTurn = z.infer<typeof TutorTurn>;
