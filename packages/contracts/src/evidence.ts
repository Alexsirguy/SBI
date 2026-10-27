import { z } from "zod";
import { Confidence, Id, IsoDate, IsoDateTime, Uuid } from "./common";

export const SourceType = z.enum([
  "textbook",
  "institution",
  "standard",
  "peer-reviewed",
  "encyclopedia",
  "reference",
  "media",
  "other",
]);

export const RightsStatus = z.enum([
  "reusable",
  "quote-only",
  "link-only",
  "restricted",
  "unknown",
]);

export const Excerpt = z.object({
  excerptId: Id,
  location: z.string().min(1),
  // Short quotations only; the spec limits reuse to what's needed to support a claim.
  text: z.string().min(1).max(1000),
});

export const EvidenceSource = z
  .object({
    sourceId: Uuid,
    title: z.string().min(1),
    publisher: z.string().min(1).optional(),
    authors: z.array(z.string().min(1)).default([]),
    url: z.url().optional(),
    doi: z
      .string()
      .regex(/^10\.\d{4,9}\/\S+$/, "Expected a DOI like 10.1000/xyz")
      .optional(),
    sourceType: SourceType,
    publishedOn: IsoDate.optional(),
    accessedOn: IsoDate,
    excerpts: z.array(Excerpt).min(1),
    claimIds: z.array(Uuid).default([]),
    evidenceQuality: z.enum(["high", "moderate", "low"]),
    rightsStatus: RightsStatus,
    lastCheckedAt: IsoDateTime,
  })
  .refine((source) => source.url !== undefined || source.doi !== undefined, {
    message: "A source needs a url or a doi",
    path: ["url"],
  });

export const ClaimStatus = z.enum(["supported", "qualified", "disputed", "unsupported"]);

export const Claim = z
  .object({
    claimId: Uuid,
    text: z.string().min(1),
    status: ClaimStatus,
    sourceIds: z.array(Uuid).default([]),
    scope: z.string().min(1),
    confidence: Confidence,
    uncertainty: z.string().min(1).optional(),
    dependsOn: z.array(Uuid).default([]),
  })
  .refine((claim) => claim.status === "unsupported" || claim.sourceIds.length > 0, {
    message: "Only unsupported claims may have no sources",
    path: ["sourceIds"],
  });

export type EvidenceSource = z.infer<typeof EvidenceSource>;
export type Claim = z.infer<typeof Claim>;
export type ClaimStatus = z.infer<typeof ClaimStatus>;
