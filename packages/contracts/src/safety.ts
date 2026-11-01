import { z } from "zod";

/** Topics escalated conservatively (spec §12): lessons stay conceptual and point to help. */
export const SafetyCategory = z.enum([
  "medical",
  "chemical-exposure",
  "weapons",
  "self-harm",
  "dangerous-biology",
]);
export type SafetyCategory = z.infer<typeof SafetyCategory>;

/** Sent instead of a lesson when a question seeks harm; it points to safe learning or to help. */
export const PolicyResponse = z.object({
  /** Absent when the question seeks harm outside the named categories. */
  category: SafetyCategory.optional(),
  message: z.string().min(1).max(600),
  /** Who to turn to, most urgent first. */
  help: z.array(z.string().min(1).max(200)).max(4),
  policyVersion: z.string().min(1).max(40),
});
export type PolicyResponse = z.infer<typeof PolicyResponse>;
