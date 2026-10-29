import { Id, Uuid } from "@sbi/contracts";
import { z } from "zod";

export const Domain = z.enum(["maths", "physics", "biology", "chemistry", "arts"]);

// Category facts hold for every member; object-specific facts vary, so lessons must hedge them
// ("some kettles…") rather than claim them about the learner's photo.
export const FactScope = z.enum(["category", "object-specific"]);

export const TaxonomyFact = z
  .object({
    scope: FactScope,
    text: z.string().min(1),
    /** The stored claim that backs this fact (packages/evidence/snapshots/taxonomy-facts.json). */
    claimId: Uuid.optional(),
    /** No trusted source states it yet; lessons must not present it as fact. */
    unsourced: z.literal(true).optional(),
  })
  .refine((fact) => (fact.claimId === undefined) !== (fact.unsourced === undefined), {
    message: "A fact needs either a claimId or unsourced: true",
  });

export const TaxonomyPart = z.object({
  id: Id,
  label: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
});

export const TaxonomyEntry = z.object({
  id: Id,
  kind: z.enum(["category", "object"]),
  label: z.string().min(1),
  parentId: Id.optional(),
  domain: Domain.optional(),
  /** Other names for the same thing; these resolve directly to the entry. */
  aliases: z.array(z.string().min(1)).default([]),
  /** Related words that help search but are not names, like "boil" for a kettle. */
  keywords: z.array(z.string().min(1)).default([]),
  parts: z.array(TaxonomyPart).default([]),
  /** Science concepts a lesson about this entry is likely to teach. */
  concepts: z.array(z.string().min(1)).default([]),
  facts: z.array(TaxonomyFact).default([]),
});

export type Domain = z.infer<typeof Domain>;
export type FactScope = z.infer<typeof FactScope>;
export type TaxonomyFact = z.infer<typeof TaxonomyFact>;
export type TaxonomyPart = z.infer<typeof TaxonomyPart>;
export type TaxonomyEntry = z.output<typeof TaxonomyEntry>;
export type TaxonomyEntryInput = z.input<typeof TaxonomyEntry>;
