import { join } from "node:path";
import { migrate } from "drizzle-orm/mysql2/migrator";
import type { Database } from "./client";

export async function runMigrations(db: Database): Promise<void> {
  // Resolved lazily so bundlers evaluating this module never fail at import time.
  const folder = join(import.meta.dirname ?? process.cwd(), "../migrations");
  await migrate(db, { migrationsFolder: folder });
}
