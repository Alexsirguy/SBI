import { canonicalJson, sha256Hex, type VisualManifest } from "@sbi/contracts";
import type { VisualAssetRepository } from "@sbi/rights";

/**
 * Whether a manifest's spec is still the one the rights register recorded when it was generated.
 * Hand-written references have no generated record, so there is nothing to compare.
 */
export function createSpecIntegrity(assets: Pick<VisualAssetRepository, "get">) {
  return async (manifest: VisualManifest): Promise<boolean> => {
    for (const assetId of manifest.assetIds) {
      const asset = await assets.get(assetId).catch(() => undefined);
      if (asset?.format !== manifest.kind) continue;
      return asset.sha256 === (await sha256Hex(canonicalJson(manifest.spec ?? null)));
    }
    return true;
  };
}

export type SpecIntegrity = ReturnType<typeof createSpecIntegrity>;
