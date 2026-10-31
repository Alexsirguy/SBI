import { VisualManifest, visualManifestHash } from "@sbi/contracts";
import type { VisualManifestRepository } from "@sbi/visuals";
import { eq } from "drizzle-orm";
import type { Database } from "../client";
import { visualManifests } from "../schema";
import { parseDocuments } from "./document";

export function createVisualManifestRepository(db: Database): VisualManifestRepository {
  return {
    async save(input) {
      const manifest = VisualManifest.parse(input);
      const row = {
        visualId: manifest.visualId,
        kind: manifest.kind,
        sha256: await visualManifestHash(manifest),
        document: manifest,
      };
      await db.insert(visualManifests).values(row).onDuplicateKeyUpdate({ set: row });
    },
    async get(visualId) {
      const rows = await db
        .select({ document: visualManifests.document })
        .from(visualManifests)
        .where(eq(visualManifests.visualId, visualId));
      return parseDocuments(VisualManifest, rows)[0];
    },
  };
}
