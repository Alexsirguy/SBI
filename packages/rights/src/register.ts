import { VisualAsset, type Lesson, type VisualManifest } from "@sbi/contracts";
import type { VisualAssetRepository } from "./visual-asset-repository";

export interface RightsDecision {
  cleared: boolean;
  reason?: string;
}

export interface VisualManifestSource {
  get(visualId: string): Promise<VisualManifest | undefined>;
}

export interface RightsRegister {
  /** Whether one asset may be shown; `lessonId` matters only for assets limited to some lessons. */
  checkAsset(assetId: string, context?: { lessonId?: string }): Promise<RightsDecision>;
  /** Whether every visual in a lesson, with the libraries its renderer needs, may be published. */
  check(lesson: Lesson): Promise<RightsDecision>;
  /** Whether bytes about to be served are the ones the register recorded. */
  verifyChecksum(assetId: string, sha256: string): Promise<RightsDecision>;
}

const CLEARED: RightsDecision = { cleared: true };

function blocked(reason: string): RightsDecision {
  return { cleared: false, reason };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createRightsRegister(deps: {
  assets: Pick<VisualAssetRepository, "get">;
  manifests: VisualManifestSource;
  /** Asset ids of the libraries each visual kind's renderer loads. */
  librariesFor?: (kind: VisualManifest["kind"]) => readonly string[];
  today?: () => string;
}): RightsRegister {
  const today = deps.today ?? todayIso;

  async function record(assetId: string): Promise<VisualAsset | RightsDecision> {
    // A stored document that no longer parses is as unusable as a missing one, so it blocks too.
    const stored = await deps.assets.get(assetId).catch(() => undefined);
    if (!stored) return blocked(`asset ${assetId} has no rights record`);
    const parsed = VisualAsset.safeParse(stored);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((issue) => issue.path.join(".") || "record");
      return blocked(`asset ${assetId} has an incomplete rights record (${fields.join(", ")})`);
    }
    return parsed.data;
  }

  async function checkAsset(
    assetId: string,
    context: { lessonId?: string } = {},
  ): Promise<RightsDecision> {
    const asset = await record(assetId);
    if ("cleared" in asset) return asset;
    if (asset.reviewDueOn && asset.reviewDueOn < today()) {
      return blocked(`asset ${assetId} was due for review on ${asset.reviewDueOn}`);
    }
    const approvedHere =
      context.lessonId !== undefined && asset.approvedLessonIds.includes(context.lessonId);
    if (asset.approvedLessonIds.length > 0 && !approvedHere) {
      return blocked(`asset ${assetId} is approved only for other lessons`);
    }
    if (asset.commercialUse === "prohibited" || asset.commercialUse === "unknown") {
      return blocked(`asset ${assetId} has commercial use ${asset.commercialUse}`);
    }
    if (asset.commercialUse === "restricted" && !approvedHere) {
      return blocked(`asset ${assetId} is restricted and not approved for this lesson`);
    }
    return CLEARED;
  }

  return {
    checkAsset,
    async check(lesson) {
      for (const ref of lesson.visuals) {
        const manifest = await deps.manifests.get(ref.visualId);
        if (!manifest) return blocked(`visual ${ref.visualId} has no manifest`);
        if (manifest.kind !== ref.kind) {
          return blocked(`visual ${ref.visualId} is a ${manifest.kind}, not a ${ref.kind}`);
        }
        // A visual with no asset of its own would have nothing that records who made it.
        if (manifest.assetIds.length === 0) {
          return blocked(`visual ${ref.visualId} records no assets`);
        }
        const assetIds = [...manifest.assetIds, ...(deps.librariesFor?.(manifest.kind) ?? [])];
        for (const assetId of assetIds) {
          const decision = await checkAsset(assetId, { lessonId: lesson.lessonId });
          if (!decision.cleared) return decision;
        }
      }
      return CLEARED;
    },
    async verifyChecksum(assetId, sha256) {
      const asset = await record(assetId);
      if ("cleared" in asset) return asset;
      return asset.sha256 === sha256
        ? CLEARED
        : blocked(`asset ${assetId} does not match its recorded checksum`);
    },
  };
}
