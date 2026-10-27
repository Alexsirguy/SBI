import type { VisualAsset } from "@sbi/contracts";

export interface VisualAssetRepository {
  save(asset: VisualAsset): Promise<void>;
  get(assetId: string): Promise<VisualAsset | undefined>;
}
