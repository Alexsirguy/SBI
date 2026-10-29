import { z } from "zod";
import { Id } from "./common";

export const TAXONOMY_QUERY_MIN_LENGTH = 2;
export const TAXONOMY_SEARCH_LIMIT = 5;

export const TaxonomySearchRequest = z.object({
  q: z.string().trim().min(TAXONOMY_QUERY_MIN_LENGTH).max(100),
});

/** What the learner picks from: an object's canonical id and its display label. */
export const TaxonomyMatch = z.object({
  taxonomyId: Id,
  label: z.string().min(1),
});

export const TaxonomySearchResults = z.object({
  results: z.array(TaxonomyMatch).max(TAXONOMY_SEARCH_LIMIT),
});

export type TaxonomyMatch = z.infer<typeof TaxonomyMatch>;

const Observation = z.string().trim().max(100).optional();

/** Prompted observations from a learner whose object was not recognised or found. */
export const ObservationRequest = z
  .object({ shape: Observation, material: Observation, use: Observation, guess: Observation })
  .refine((notes) => Object.values(notes).some((note) => note && note.length > 0), {
    message: "Tell us at least one thing you notice.",
  });

export const ObservationMatches = z.object({
  results: z.array(TaxonomyMatch).max(TAXONOMY_SEARCH_LIMIT),
});
