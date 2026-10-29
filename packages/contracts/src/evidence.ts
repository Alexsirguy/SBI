import { z } from "zod";
import { Confidence, Id, IsoDate, IsoDateTime, Sha256, Uuid } from "./common";

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

export const SourceAccess = z.enum(["full-text", "abstract", "metadata-only"]);

/** How and when a connector fetched the source, so rights and freshness can be audited later. */
export const SourceRetrieval = z.object({
  connector: Id,
  fetchedAt: IsoDateTime,
  access: SourceAccess,
  // The licence as the publisher states it; rightsStatus is our reading of it.
  license: z.string().min(1).max(300).optional(),
  contentSha256: Sha256,
});

/** What kind of evidence a source is; a single primary study needs a limitation note (§7). */
export const StudyDesign = z.enum(["primary-study", "review", "not-research"]);

export const FreshnessStatus = z.enum(["current", "changed", "gone", "rights-changed"]);

/** Result of the last re-check; anything but "current" means lessons citing it need review. */
export const SourceFreshness = z.object({
  status: FreshnessStatus,
  checkedAt: IsoDateTime,
  missingExcerptIds: z.array(Id).default([]),
});

export const Excerpt = z.object({
  excerptId: Id,
  // Where in the source the text sits (section, page or paragraph), so a reader can check it.
  location: z.string().min(1).max(200),
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
    retrieval: SourceRetrieval.optional(),
    freshness: SourceFreshness.optional(),
    studyDesign: StudyDesign.optional(),
  })
  .refine((source) => source.url !== undefined || source.doi !== undefined, {
    message: "A source needs a url or a doi",
    path: ["url"],
  })
  .refine(
    (source) =>
      new Set(source.excerpts.map((excerpt) => excerpt.excerptId)).size === source.excerpts.length,
    { message: "Excerpt ids must be unique within a source", path: ["excerpts"] },
  );

/** Names one stored excerpt, so a claim's support can be checked word for word. */
export const ExcerptRef = z.object({ sourceId: Uuid, excerptId: Id });

/** Which judge (model + prompt version) checked the claim against its excerpts, and when. */
export const ClaimVerification = z.object({
  judge: z.string().min(1).max(200),
  verifiedAt: IsoDateTime,
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
    // Optional, not defaulted, so claims written before citations keep their lesson content hash.
    citations: z.array(ExcerptRef).optional(),
    // Absent means non-trivial: only textbook basics may rest on one source.
    significance: z.enum(["basic", "non-trivial"]).optional(),
    limitations: z.string().min(1).max(300).optional(),
    verification: ClaimVerification.optional(),
  })
  .refine((claim) => claim.status === "unsupported" || claim.sourceIds.length > 0, {
    message: "Only unsupported claims may have no sources",
    path: ["sourceIds"],
  })
  .refine(
    (claim) => (claim.citations ?? []).every((ref) => claim.sourceIds.includes(ref.sourceId)),
    {
      message: "Citations must point at the claim's own sources",
      path: ["citations"],
    },
  )
  .refine((claim) => !claim.dependsOn.includes(claim.claimId), {
    message: "A claim cannot depend on itself",
    path: ["dependsOn"],
  });

/** Emitted when a source changes under its claims, so caches drop lessons built on them. */
export const EvidenceInvalidated = z.object({
  type: z.literal("evidence.invalidated"),
  sourceId: Uuid,
  reason: FreshnessStatus.exclude(["current"]),
  // The claims citing the source plus every claim that builds on them.
  claimIds: z.array(Uuid),
  detectedAt: IsoDateTime,
});

export type EvidenceSource = z.infer<typeof EvidenceSource>;
export type EvidenceInvalidated = z.infer<typeof EvidenceInvalidated>;
export type FreshnessStatus = z.infer<typeof FreshnessStatus>;
export type StudyDesign = z.infer<typeof StudyDesign>;
export type SourceAccess = z.infer<typeof SourceAccess>;
export type SourceRetrieval = z.infer<typeof SourceRetrieval>;
export type RightsStatus = z.infer<typeof RightsStatus>;
export type SourceType = z.infer<typeof SourceType>;
export type Claim = z.infer<typeof Claim>;
export type ClaimStatus = z.infer<typeof ClaimStatus>;
export type ExcerptRef = z.infer<typeof ExcerptRef>;
export type ClaimVerification = z.infer<typeof ClaimVerification>;
