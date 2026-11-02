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

/** The youngest age band a question suits; most science suits everyone. */
export const SuitableFor = z.enum(["everyone", "teen", "adult"]);
export type SuitableFor = z.infer<typeof SuitableFor>;

/** Sent instead of a lesson when a question seeks harm, or suits an older age band than the one chosen. */
export const PolicyResponse = z.object({
  reason: z.enum(["harm", "age"]).default("harm"),
  /** For an age hold, the band that unlocks the answer. */
  suitableFor: SuitableFor.exclude(["everyone"]).optional(),
  /** Absent when the question seeks harm outside the named categories. */
  category: SafetyCategory.optional(),
  message: z.string().min(1).max(600),
  /** Who to turn to, most urgent first. */
  help: z.array(z.string().min(1).max(200)).max(4),
  policyVersion: z.string().min(1).max(40),
});
export type PolicyResponse = z.infer<typeof PolicyResponse>;
