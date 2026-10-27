import { VisualAsset } from "@sbi/contracts";
import type { VisualAssetRepository } from "@sbi/rights";
import { eq } from "drizzle-orm";
import type { Database } from "../client";
import { visualAssets } from "../schema";
import { parseDocuments } from "./document";

export function createVisualAssetRepository(db: Database): VisualAssetRepository {
  return {
    async save(input) {
      const asset = VisualAsset.parse(input);
      const row = {
        assetId: asset.assetId,
        kind: asset.kind,
        commercialUse: asset.commercialUse,
        document: asset,
      };
      await db.insert(visualAssets).values(row).onDuplicateKeyUpdate({ set: row });
    },
    async get(assetId) {
      const rows = await db
        .select({ document: visualAssets.document })
        .from(visualAssets)
        .where(eq(visualAssets.assetId, assetId));
      return parseDocuments(VisualAsset, rows)[0];
    },
  };
}
