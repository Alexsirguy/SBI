import { createEnv } from "@sbi/env";
import { LIBRARY_ASSETS } from "@sbi/rights";
import { z } from "zod";
import { createDatabase } from "../src/client";
import { runMigrations } from "../src/migrate";
import { createVisualAssetRepository } from "../src/repositories/visual-assets";

const env = createEnv(z.object({ DATABASE_URL: z.url() }), process.env);
const { db, close } = createDatabase(env.DATABASE_URL);

try {
  await runMigrations(db);
  console.log("Migrations applied.");
  // Every deploy migrates, so library records always match the versions the code pins.
  const assets = createVisualAssetRepository(db);
  for (const asset of LIBRARY_ASSETS) await assets.save(asset);
  console.log(`Rights register: ${LIBRARY_ASSETS.length} library records up to date.`);
} finally {
  await close();
}
