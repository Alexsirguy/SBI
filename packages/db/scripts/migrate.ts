import { createEnv } from "@sbi/env";
import { LIBRARY_ASSETS } from "@sbi/rights";
import { curriculumCatalogue } from "@sbi/taxonomy/curriculum";
import { REFERENCE_VISUALS, referenceAssets } from "@sbi/visuals";
import { z } from "zod";
import { createDatabase } from "../src/client";
import { runMigrations } from "../src/migrate";
import { createCurriculumRepository } from "../src/repositories/curriculum";
import { createVisualAssetRepository } from "../src/repositories/visual-assets";
import { createVisualManifestRepository } from "../src/repositories/visual-manifests";

const env = createEnv(z.object({ DATABASE_URL: z.url() }), process.env);
const { db, close } = createDatabase(env.DATABASE_URL);

try {
  await runMigrations(db);
  console.log("Migrations applied.");
  // Every deploy migrates, so library records always match the versions the code pins.
  const assets = createVisualAssetRepository(db);
  for (const asset of LIBRARY_ASSETS) await assets.save(asset);
  console.log(`Rights register: ${LIBRARY_ASSETS.length} library records up to date.`);
  // The hand-checked references are served like generated visuals, with their own records.
  const references = await referenceAssets();
  for (const asset of references) await assets.save(asset);
  const manifests = createVisualManifestRepository(db);
  for (const manifest of Object.values(REFERENCE_VISUALS)) await manifests.save(manifest);
  console.log(`Reference visuals: ${references.length} up to date.`);
  // The repo's topic files are the reviewed source; each deploy brings the tables into line.
  const synced = await createCurriculumRepository(db).sync(curriculumCatalogue(), new Date());
  console.log(`Curriculum: ${synced.topics} topics up to date, ${synced.retired} retired.`);
} finally {
  await close();
}
