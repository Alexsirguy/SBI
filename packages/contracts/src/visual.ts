import { z } from "zod";
import { Id, IsoDate, Sha256 } from "./common";

export const License = z.object({
  id: z.string().min(1),
  version: z.string().min(1).optional(),
  url: z.url().optional(),
});

export const VisualAssetKind = z.enum(["renderer", "model", "repository", "simulation", "data"]);

// Code licenses never grant rights to models or media, so the two are recorded separately.
export const VisualAsset = z
  .object({
    assetId: Id,
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
    approvedLessonIds: z.array(Id).default([]),
  })
  .refine((asset) => asset.softwareLicense !== undefined || asset.assetLicense !== undefined, {
    message: "Record a software or asset license",
    path: ["assetLicense"],
  })
  .refine((asset) => !asset.modified || asset.modificationNotes !== undefined, {
    message: "Describe modifications when modified is true",
    path: ["modificationNotes"],
  });

export const VisualKind = z.enum([
  "svg-diagram",
  "canvas-diagram",
  "gltf-model",
  "simulation",
  "molecular",
]);

export const VisualFallback = z.object({
  text: z.string().min(1),
  stillImageUrl: z.url().optional(),
});

export const VisualManifest = z.object({
  visualId: Id,
  kind: VisualKind,
  alt: z.string().min(1),
  longDescription: z.string().min(1).optional(),
  fallback: VisualFallback,
  assetIds: z.array(Id).default([]),
  assumptions: z.array(z.string().min(1)).default([]),
  params: z.record(z.string(), z.unknown()).default({}),
});

export const VisualRef = z.object({
  visualId: Id,
  kind: VisualKind,
  manifestUri: z.string().min(1),
  alt: z.string().min(1),
});

export type VisualAsset = z.infer<typeof VisualAsset>;
export type VisualKind = z.infer<typeof VisualKind>;
export type VisualManifest = z.infer<typeof VisualManifest>;
export type VisualRef = z.infer<typeof VisualRef>;
