import { createEnv } from "@sbi/env";
import { z } from "zod";
import { createDatabase } from "../src/client";
import { runMigrations } from "../src/migrate";

const env = createEnv(z.object({ DATABASE_URL: z.url() }), process.env);
const { db, close } = createDatabase(env.DATABASE_URL);

try {
  await runMigrations(db);
  console.log("Migrations applied.");
} finally {
  await close();
}
