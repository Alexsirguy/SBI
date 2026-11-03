import { z } from "zod";
import { IsoDateTime, Uuid } from "./common";
import { ConsentVersion } from "./consent";
import { ControlSetting } from "./lesson";
import { PolicyResponse, SafetyCategory } from "./safety";

/** The policy's categories, plus none and other, so every tutor turn records one. */
export const TurnSafetyCategory = z.enum(["none", ...SafetyCategory.options, "other"]);

export const RetentionClass = z.enum(["session", "quality-review", "research-consented"]);
export type RetentionClass = z.infer<typeof RetentionClass>;

/** Lesson replies cite claims; beyond-lesson ones carry the note instead (ADR 0025). */
export const TutorReplyKind = z.enum([
  "lesson",
  "beyond-lesson",
  "clarifying",
  "policy",
  "fallback",
]);
export type TutorReplyKind = z.infer<typeof TutorReplyKind>;

/** What "watch this" does to the lesson's existing visual; checked against its manifest (#96). */
export const VisualAction = z
  .object({
    visualId: Uuid,
    settings: z.array(ControlSetting).max(4).default([]),
    /** Index into the lesson's demonstration steps; its settings are copied into `settings`. */
    step: z.int().nonnegative().optional(),
    /** A label id from the manifest's parts key. */
    highlight: z
      .string()
      .regex(/^[a-z][a-zA-Z0-9]{0,39}$/)
      .optional(),
  })
  .refine((action) => action.settings.length > 0 || action.highlight !== undefined, {
    message: "An action moves a slider or highlights a part",
  });
export type VisualAction = z.infer<typeof VisualAction>;

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
      kind: TutorReplyKind.optional(),
      visualAction: VisualAction.optional(),
      /** Set when safety answered instead of the model, so a reload shows the same help. */
      policy: PolicyResponse.optional(),
    }),
    safetyCategory: TurnSafetyCategory,
    modelVersion: z.string().min(1),
    promptVersion: z.string().min(1),
    feedback: z.enum(["helpful", "not-helpful"]).optional(),
    retentionClass: RetentionClass,
    /** The research opt-in this turn was kept under; required for research-consented turns. */
    consentVersion: ConsentVersion.optional(),
    createdAt: IsoDateTime,
  })
  .refine((turn) => turn.retentionClass !== "research-consented" || !!turn.consentVersion, {
    message: "Turns kept for research must record the consent they were kept under",
    path: ["consentVersion"],
  })
  .refine(
    (turn) => turn.response.citedClaimIds.every((id) => turn.retrievedClaimIds.includes(id)),
    {
      message: "Responses may only cite retrieved claims",
      path: ["response", "citedClaimIds"],
    },
  );

export type TutorTurn = z.infer<typeof TutorTurn>;
