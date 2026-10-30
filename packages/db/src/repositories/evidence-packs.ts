import { EvidencePack, type EvidencePackRepository } from "@sbi/evidence";
import { eq } from "drizzle-orm";
import type { Database } from "../client";
import { evidencePacks } from "../schema";
import { parseDocuments } from "./document";

export function createEvidencePackRepository(db: Database): EvidencePackRepository {
  return {
    async get(packKey) {
      const rows = await db
        .select({ document: evidencePacks.document })
        .from(evidencePacks)
        .where(eq(evidencePacks.packKey, packKey))
        .limit(1);
      return parseDocuments(EvidencePack, rows)[0];
    },
    async save(input) {
      const pack = EvidencePack.parse(input);
      const row = {
        packKey: pack.packKey,
        taxonomyId: pack.taxonomyId,
        createdAt: new Date(pack.createdAt),
        document: pack,
      };
      await db.insert(evidencePacks).values(row).onDuplicateKeyUpdate({ set: row });
    },
  };
}
