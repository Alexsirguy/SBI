import { join } from "node:path";
import { migrate } from "drizzle-orm/mysql2/migrator";
import type { Database } from "./client";

export const MIGRATIONS_FOLDER = join(import.meta.dirname, "../migrations");

export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
