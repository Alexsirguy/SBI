import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";

export type Database = MySql2Database;

export type LockResult<T> = { acquired: true; value: T } | { acquired: false };

export interface DatabaseHandle {
  db: Database;
  /** Runs `task` only if no other process holds the named lock; never waits for it. */
  withLock<T>(name: string, task: () => Promise<T>): Promise<LockResult<T>>;
  close(): Promise<void>;
}

export function createDatabase(url: string): DatabaseHandle {
  const pool = createPool({ uri: url, timezone: "Z" });
  return {
    close: () => pool.end(),
    db: drizzle(pool, { mode: "default" }),
    // MariaDB locks belong to a session, so one pooled connection is held for the whole task.
    async withLock(name, task) {
      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.query("SELECT GET_LOCK(?, 0) AS acquired", [name]);
        if ((rows as { acquired: number | null }[])[0]?.acquired !== 1) {
          return { acquired: false };
        }
        try {
          return { acquired: true, value: await task() };
        } finally {
          await connection.query("SELECT RELEASE_LOCK(?)", [name]);
        }
      } finally {
        connection.release();
      }
    },
  };
}
