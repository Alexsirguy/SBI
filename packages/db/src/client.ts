import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";

export type Database = MySql2Database;

export interface DatabaseHandle {
  db: Database;
  close(): Promise<void>;
}

export function createDatabase(url: string): DatabaseHandle {
  const pool = createPool({ uri: url, timezone: "Z" });
  return { db: drizzle(pool, { mode: "default" }), close: () => pool.end() };
}
