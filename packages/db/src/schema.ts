import {
  boolean,
  char,
  datetime,
  index,
  int,
  mysqlTable,
  primaryKey,
  uniqueIndex,
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
    index("lessons_taxonomy_idx").on(table.taxonomyId),
  ],
);

// Evidence gathered for one object and question, reused while its claims stay fresh (#210).
export const evidencePacks = mysqlTable(
  "evidence_packs",
  {
    packKey: char("pack_key", { length: 64 }).primaryKey(),
    taxonomyId: id("taxonomy_id").notNull(),
    createdAt: timestamp("created_at").notNull(),
    document: jsonDocument("document").notNull(),
  },
  (table) => [index("evidence_packs_taxonomy_idx").on(table.taxonomyId)],
);

// Append-only review trail (#55): who moved a lesson version between review states, and when.
export const lessonReviewEvents = mysqlTable(
  "lesson_review_events",
  {
    eventId: uuid("event_id").primaryKey(),
    lessonId: uuid("lesson_id").notNull(),
    version: int("version").notNull(),
    fromStatus: varchar("from_status", { length: 32 }).notNull(),
    toStatus: varchar("to_status", { length: 32 }).notNull(),
    reviewedBy: varchar("reviewed_by", { length: 200 }).notNull(),
    at: timestamp("at").notNull(),
    reason: varchar("reason", { length: 2000 }),
  },
  (table) => [index("lesson_review_events_lesson_idx").on(table.lessonId, table.version, table.at)],
);

// Learner feedback per lesson version; no learner identifier is stored, only what they chose to say.
export const lessonFeedback = mysqlTable(
  "lesson_feedback",
  {
    feedbackId: uuid("feedback_id").primaryKey(),
    lessonId: uuid("lesson_id").notNull(),
    version: int("version").notNull(),
    category: varchar("category", { length: 32 }),
    details: varchar("details", { length: 1000 }),
    helpful: int("helpful"),
    clear: int("clear"),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("lesson_feedback_lesson_idx").on(table.lessonId, table.version, table.createdAt),
  ],
);

// Which claims each lesson version shows, so an invalidated claim finds its lessons by index.
export const lessonClaims = mysqlTable(
  "lesson_claims",
  {
    lessonId: uuid("lesson_id").notNull(),
    version: int("version").notNull(),
    claimId: uuid("claim_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.lessonId, table.version, table.claimId] }),
    index("lesson_claims_claim_idx").on(table.claimId),
  ],
);

export const evidenceSources = mysqlTable(
  "evidence_sources",
  {
    sourceId: uuid("source_id").primaryKey(),
    // Hash of the DOI or URL key; URLs can outgrow an index, the hash cannot.
    locatorSha256: char("locator_sha256", { length: 64 }).notNull(),
    rightsStatus: varchar("rights_status", { length: 32 }).notNull(),
    lastCheckedAt: timestamp("last_checked_at").notNull(),
    document: jsonDocument("document").notNull(),
  },
  (table) => [
    uniqueIndex("evidence_sources_locator_idx").on(table.locatorSha256),
    index("evidence_sources_checked_idx").on(table.lastCheckedAt),
  ],
);

export const claims = mysqlTable(
  "claims",
  {
    claimId: uuid("claim_id").primaryKey(),
    status: varchar("status", { length: 32 }).notNull(),
    judgeVersion: varchar("judge_version", { length: 200 }),
    document: jsonDocument("document").notNull(),
  },
  (table) => [index("claims_judge_idx").on(table.judgeVersion)],
);

// Edges copied out of the claim document so dependents and citing claims are indexed lookups.
export const claimDependencies = mysqlTable(
  "claim_dependencies",
  {
    claimId: uuid("claim_id")
      .notNull()
      .references(() => claims.claimId, { onDelete: "cascade" }),
    dependsOn: uuid("depends_on").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.claimId, table.dependsOn] }),
    index("claim_dependencies_depends_on_idx").on(table.dependsOn),
  ],
);

export const claimSources = mysqlTable(
  "claim_sources",
  {
    claimId: uuid("claim_id")
      .notNull()
      .references(() => claims.claimId, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.claimId, table.sourceId] }),
    index("claim_sources_source_idx").on(table.sourceId),
  ],
);

export const visualAssets = mysqlTable("visual_assets", {
  assetId: uuid("asset_id").primaryKey(),
  kind: varchar("kind", { length: 32 }).notNull(),
  commercialUse: varchar("commercial_use", { length: 32 }).notNull(),
  document: jsonDocument("document").notNull(),
});

export const visualManifests = mysqlTable("visual_manifests", {
  visualId: uuid("visual_id").primaryKey(),
  kind: varchar("kind", { length: 32 }).notNull(),
  sha256: char("sha256", { length: 64 }).notNull(),
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
