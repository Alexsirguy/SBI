import {
  bigint,
  char,
  datetime,
  index,
  int,
  mysqlTable,
  primaryKey,
  varchar,
} from "drizzle-orm/mysql-core";
import { jsonDocument } from "./json-document";

const id = (name: string) => varchar(name, { length: 200 });
const timestamp = (name: string) => datetime(name, { mode: "date", fsp: 3 });

export const lessons = mysqlTable(
  "lessons",
  {
    lessonId: id("lesson_id").notNull(),
    version: int("version").notNull(),
    taxonomyId: id("taxonomy_id").notNull(),
    locale: varchar("locale", { length: 16 }).notNull(),
    reviewStatus: varchar("review_status", { length: 32 }).notNull(),
    safetyClass: varchar("safety_class", { length: 16 }).notNull(),
    cacheScope: varchar("cache_scope", { length: 16 }).notNull(),
    intentSignature: varchar("intent_signature", { length: 500 }).notNull(),
    contentHash: char("content_hash", { length: 64 }).notNull(),
    document: jsonDocument("document").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.lessonId, table.version] }),
    index("lessons_intent_idx").on(table.intentSignature),
    index("lessons_content_hash_idx").on(table.contentHash),
  ],
);

export const evidenceSources = mysqlTable("evidence_sources", {
  sourceId: id("source_id").primaryKey(),
  rightsStatus: varchar("rights_status", { length: 32 }).notNull(),
  lastCheckedAt: timestamp("last_checked_at").notNull(),
  document: jsonDocument("document").notNull(),
});

export const claims = mysqlTable("claims", {
  claimId: id("claim_id").primaryKey(),
  status: varchar("status", { length: 32 }).notNull(),
  document: jsonDocument("document").notNull(),
});

export const visualAssets = mysqlTable("visual_assets", {
  assetId: id("asset_id").primaryKey(),
  kind: varchar("kind", { length: 32 }).notNull(),
  commercialUse: varchar("commercial_use", { length: 32 }).notNull(),
  document: jsonDocument("document").notNull(),
});

export const recognitionResults = mysqlTable(
  "recognition_results",
  {
    // Drizzle's serial() emits "serial AUTO_INCREMENT", which MariaDB rejects.
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    sessionId: id("session_id").notNull(),
    imageSha256: char("image_sha256", { length: 64 }).notNull(),
    createdAt: timestamp("created_at").notNull(),
    deleteBy: timestamp("delete_by").notNull(),
    document: jsonDocument("document").notNull(),
  },
  (table) => [
    index("recognition_session_idx").on(table.sessionId),
    index("recognition_delete_by_idx").on(table.deleteBy),
  ],
);

export const tutorTurns = mysqlTable(
  "tutor_turns",
  {
    sessionId: id("session_id").notNull(),
    turnId: id("turn_id").notNull(),
    lessonId: id("lesson_id").notNull(),
    lessonVersion: int("lesson_version").notNull(),
    retentionClass: varchar("retention_class", { length: 32 }).notNull(),
    createdAt: timestamp("created_at").notNull(),
    document: jsonDocument("document").notNull(),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.turnId] })],
);
