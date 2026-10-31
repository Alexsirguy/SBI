import { z } from "zod";
import { IsoDate, Sha256, Uuid } from "./common";

export const License = z.object({
  id: z.string().min(1),
  version: z.string().min(1).optional(),
  url: z.url().optional(),
});

export const VisualAssetKind = z.enum(["renderer", "model", "repository", "simulation", "data"]);

// Code licenses never grant rights to models or media, so the two are recorded separately.
export const VisualAsset = z
  .object({
    assetId: Uuid,
    kind: VisualAssetKind,
    sourceUrl: z.url(),
    creator: z.string().min(1),
    softwareLicense: License.optional(),
    assetLicense: License.optional(),
    attribution: z.string().min(1),
    modified: z.boolean(),
    modificationNotes: z.string().min(1).optional(),
    commercialUse: z.enum(["allowed", "restricted", "prohibited", "unknown"]),
    sha256: Sha256,
    format: z.string().min(1),
    sizeBytes: z.int().nonnegative(),
    accessibilityFallback: z.string().min(1),
    reviewOwner: z.string().min(1),
    reviewDueOn: IsoDate.optional(),
    approvedLessonIds: z.array(Uuid).default([]),
  })
  .refine((asset) => asset.softwareLicense !== undefined || asset.assetLicense !== undefined, {
    message: "Record a software or asset license",
    path: ["assetLicense"],
  })
  .refine((asset) => !asset.modified || asset.modificationNotes !== undefined, {
    message: "Describe modifications when modified is true",
    path: ["modificationNotes"],
  });

// ADR 0014: each kind is a spec format the AI writes and a renderer we own; playground is the fallback.
export const VisualKind = z.enum(["mechanism", "molecule", "process", "graph", "playground"]);

export const VisualFallback = z.object({
  text: z.string().min(1),
  stillImageUrl: z.url().optional(),
});

export const VisualManifest = z.object({
  visualId: Uuid,
  kind: VisualKind,
  alt: z.string().min(1),
  longDescription: z.string().min(1).optional(),
  fallback: VisualFallback,
  assetIds: z.array(Uuid).default([]),
  assumptions: z.array(z.string().min(1)).default([]),
  params: z.record(z.string(), z.unknown()).default({}),
});

export const VisualRef = z.object({
  visualId: Uuid,
  kind: VisualKind,
  manifestUri: z.string().min(1),
  alt: z.string().min(1),
});

export const VisualRequest = z.object({ visualId: Uuid });

/** Where a client fetches a visual's manifest; GET routes take their request as query parameters. */
export function visualManifestUri(visualId: string): string {
  return `/visuals?visualId=${encodeURIComponent(visualId)}`;
}

export type VisualAsset = z.infer<typeof VisualAsset>;
export type VisualFallback = z.infer<typeof VisualFallback>;
export type VisualKind = z.infer<typeof VisualKind>;
export type VisualManifest = z.infer<typeof VisualManifest>;
export type VisualRef = z.infer<typeof VisualRef>;
export type VisualRequest = z.infer<typeof VisualRequest>;
