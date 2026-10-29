import type { CatalogGapRepository, GapSource } from "@sbi/taxonomy";
import { desc, sql } from "drizzle-orm";
import type { Database } from "../client";
import { catalogGaps } from "../schema";

export function createCatalogGapRepository(db: Database): CatalogGapRepository {
  return {
    async record(term, source, at) {
      await db
        .insert(catalogGaps)
        .values({ count: 1, firstSeen: at, lastSeen: at, source, term })
        .onDuplicateKeyUpdate({ set: { count: sql`${catalogGaps.count} + 1`, lastSeen: at } });
    },
    async top(limit) {
      const rows = await db
        .select()
        .from(catalogGaps)
        .orderBy(desc(catalogGaps.count), desc(catalogGaps.lastSeen))
        .limit(limit);
      return rows.map((row) => ({ ...row, source: row.source as GapSource }));
    },
  };
}
