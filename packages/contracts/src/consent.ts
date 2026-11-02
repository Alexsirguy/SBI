import { z } from "zod";

/** Bumped whenever the wording of a choice changes, so older agreements can be told apart. */
export const CONSENT_VERSION = "consent-1";
export const ConsentVersion = z.string().regex(/^consent-\d+$/);

/** Each purpose is asked for on its own, never bundled (spec §12); all start off. */
export const ConsentPurpose = z.enum(["save-photos", "account", "model-improvement", "research"]);
export type ConsentPurpose = z.infer<typeof ConsentPurpose>;

export const ConsentRecord = z.object({
  version: ConsentVersion,
  choices: z.record(ConsentPurpose, z.boolean()),
  decidedAt: z.iso.datetime({ offset: true }),
});
export type ConsentRecord = z.infer<typeof ConsentRecord>;
