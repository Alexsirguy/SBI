import {
  boolean,
  char,
  datetime,
  index,
  int,
  mysqlTable,
  primaryKey,
  varchar,
} from "drizzle-orm/mysql-core";
import { jsonDocument } from "./json-document";
import { uuid } from "./uuid-column";

const id = (name: string) => varchar(name, { length: 200 });
const timestamp = (name: string) => datetime(name, { mode: "date", fsp: 3 });

export const lessons = mysqlTable(
  "lessons",
  {
    lessonId: uuid("lesson_id").notNull(),
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
  sourceId: uuid("source_id").primaryKey(),
  rightsStatus: varchar("rights_status", { length: 32 }).notNull(),
  lastCheckedAt: timestamp("last_checked_at").notNull(),
  document: jsonDocument("document").notNull(),
});

export const claims = mysqlTable("claims", {
  claimId: uuid("claim_id").primaryKey(),
  status: varchar("status", { length: 32 }).notNull(),
  document: jsonDocument("document").notNull(),
});

export const visualAssets = mysqlTable("visual_assets", {
  assetId: uuid("asset_id").primaryKey(),
  kind: varchar("kind", { length: 32 }).notNull(),
  commercialUse: varchar("commercial_use", { length: 32 }).notNull(),
  document: jsonDocument("document").notNull(),
});

export const recognitionResults = mysqlTable(
  "recognition_results",
  {
    resultId: uuid("result_id").primaryKey(),
    sessionId: uuid("session_id").notNull(),
    imageSha256: char("image_sha256", { length: 64 }).notNull(),
    createdAt: timestamp("created_at").notNull(),
    deleteBy: timestamp("delete_by").notNull(),
    document: jsonDocument("document").notNull(),
  },
  (table) => [
    index("recognition_session_idx").on(table.sessionId),
    index("recognition_delete_by_idx").on(table.deleteBy),
    index("recognition_image_idx").on(table.imageSha256),
  ],
);

export const tutorTurns = mysqlTable(
  "tutor_turns",
  {
    sessionId: uuid("session_id").notNull(),
    turnId: uuid("turn_id").notNull(),
    lessonId: uuid("lesson_id").notNull(),
    lessonVersion: int("lesson_version").notNull(),
    retentionClass: varchar("retention_class", { length: 32 }).notNull(),
    createdAt: timestamp("created_at").notNull(),
    document: jsonDocument("document").notNull(),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.turnId] })],
);

// Registry of stored photos and their deletion dates; the bytes live in private object storage.
export const mediaObjects = mysqlTable(
  "media_objects",
  {
    objectKey: varchar("object_key", { length: 300 }).primaryKey(),
    kind: varchar("kind", { length: 16 }).notNull(),
    createdAt: timestamp("created_at").notNull(),
    expiresAt: timestamp("expires_at"),
    savedByUser: boolean("saved_by_user").notNull().default(false),
    deletingAt: timestamp("deleting_at"),
  },
  (table) => [index("media_objects_expires_idx").on(table.expiresAt)],
);

export const deletionAuditLog = mysqlTable(
  "deletion_audit_log",
  {
    auditId: uuid("audit_id").primaryKey(),
    objectKey: varchar("object_key", { length: 300 }).notNull(),
    kind: varchar("kind", { length: 16 }).notNull(),
    deletedAt: timestamp("deleted_at").notNull(),
    reason: varchar("reason", { length: 200 }).notNull(),
  },
  (table) => [index("deletion_audit_log_deleted_idx").on(table.deletedAt)],
);

// Aggregated catalog gaps: one row per normalised term, never linked to a learner or photo.
export const catalogGaps = mysqlTable(
  "catalog_gaps",
  {
    term: varchar("term", { length: 60 }).notNull(),
    source: varchar("source", { length: 32 }).notNull(),
    count: int("count").notNull(),
    firstSeen: timestamp("first_seen").notNull(),
    lastSeen: timestamp("last_seen").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.term, table.source] }),
    index("catalog_gaps_count_idx").on(table.count),
  ],
);
