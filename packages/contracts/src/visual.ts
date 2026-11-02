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

// Ids name the spec's own elements and variables, so they stay simple enough to use in formulas.
const VisualName = z.string().regex(/^[a-z][a-zA-Z0-9]{0,39}$/, "Use a short camelCase name");

/** A named part of the visual, tied to the lesson claim that says what it is. */
export const VisualLabel = z.object({
  id: VisualName,
  text: z.string().min(1).max(60),
  claimId: Uuid,
});

/** A slider the learner moves; formulas and the spec read its value by `id`. */
export const VisualControl = z
  .object({
    id: VisualName,
    label: z.string().min(1).max(60),
    unit: z.string().max(16).default(""),
    min: z.number(),
    max: z.number(),
    step: z.number().positive(),
    value: z.number(),
  })
  .refine((control) => control.min < control.max, {
    message: "min must be below max",
    path: ["max"],
  })
  .refine((control) => control.value >= control.min && control.value <= control.max, {
    message: "value must sit within min and max",
    path: ["value"],
  });

/** A number worked out from the sliders with a mathjs formula, never with code. */
export const VisualReadout = z.object({
  id: VisualName,
  label: z.string().min(1).max(60),
  unit: z.string().max(16).default(""),
  formula: z.string().min(1).max(300),
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
  labels: z.array(VisualLabel).max(20).default([]),
  controls: z.array(VisualControl).max(8).default([]),
  readouts: z.array(VisualReadout).max(8).default([]),
  /** The kind's own format: MJCF or Mermaid text, or a JSON object such as a Vega-Lite spec. */
  spec: z.union([z.string().max(20_000), z.record(z.string(), z.unknown())]).optional(),
});

/** What a learner sees to credit one third-party asset, as its licence requires (spec §12). */
export const AssetCredit = z.object({
  assetId: Uuid,
  /** Title or creator, licence and changes, in one line, e.g. "3D structure from PubChem…". */
  text: z.string().min(1),
  /** The asset's own page, where its creator and terms are published. */
  itemUrl: z.url().optional(),
  license: z.object({ label: z.string().min(1), url: z.url().optional() }),
  /** Reusing or adapting it obliges sharing under the same licence. */
  shareAlike: z.boolean(),
  changes: z.string().min(1).optional(),
});

/** A manifest as served, with the credits of the third-party assets it uses. */
export const ServedVisual = VisualManifest.extend({ credits: z.array(AssetCredit).default([]) });

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

export type AssetCredit = z.infer<typeof AssetCredit>;
export type ServedVisual = z.infer<typeof ServedVisual>;
export type VisualAsset = z.infer<typeof VisualAsset>;
export type VisualFallback = z.infer<typeof VisualFallback>;
export type VisualControl = z.infer<typeof VisualControl>;
export type VisualKind = z.infer<typeof VisualKind>;
export type VisualLabel = z.infer<typeof VisualLabel>;
export type VisualReadout = z.infer<typeof VisualReadout>;
export type VisualManifest = z.infer<typeof VisualManifest>;
export type VisualRef = z.infer<typeof VisualRef>;
export type VisualRequest = z.infer<typeof VisualRequest>;
