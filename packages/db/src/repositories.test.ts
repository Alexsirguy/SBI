import { join } from "node:path";
import {
  Claim,
  EvidenceSource,
  Lesson,
  newId,
  RecognitionResult,
  TutorTurn,
  VisualAsset,
  type Lesson as LessonRecord,
} from "@sbi/contracts";
import { loadFixtures } from "@sbi/testing";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type DatabaseHandle } from "./client";
import { runMigrations } from "./migrate";
import { createRepositories, type Repositories } from "./repositories";

try {
  process.loadEnvFile(join(import.meta.dirname, "../.env"));
} catch {
  // No local .env; CI provides TEST_DATABASE_URL directly.
}

const url = process.env.TEST_DATABASE_URL;
const fixtures = join(import.meta.dirname, "../../contracts/src/fixtures");
const TABLES = [
  "lessons",
  "evidence_sources",
  "claims",
  "visual_assets",
  "recognition_results",
  "tutor_turns",
  "media_objects",
  "deletion_audit_log",
];

function fixture<T>(schema: { parse(input: unknown): T }, contract: string, name: string): T {
  const found = loadFixtures(join(fixtures, contract)).valid.find(
    (item) => item.name === `${name}.json`,
  );
  return schema.parse(found?.data);
}

describe.skipIf(!url)("repositories (MariaDB)", () => {
  let handle: DatabaseHandle;
  let repos: Repositories;

  beforeAll(async () => {
    handle = createDatabase(url ?? "");
    await runMigrations(handle.db);
    repos = createRepositories(handle.db);
  });

  beforeEach(async () => {
    for (const table of TABLES) await handle.db.execute(sql.raw(`DELETE FROM \`${table}\``));
  });

  afterAll(async () => {
    await handle.close();
  });

  describe("lessons", () => {
    const lesson = fixture(Lesson, "lesson", "kettle-full");

    it("round-trips a lesson unchanged", async () => {
      await repos.lessons.save(lesson);
      expect(await repos.lessons.get(lesson.lessonId, lesson.version)).toEqual(lesson);
    });

    it("keeps every version and returns the latest", async () => {
      const v2: LessonRecord = {
        ...lesson,
        version: 2,
        title: "Why a kettle boils water (revised)",
      };
      await repos.lessons.save(lesson);
      await repos.lessons.save(v2);

      expect((await repos.lessons.latest(lesson.lessonId))?.version).toBe(2);
      expect((await repos.lessons.get(lesson.lessonId, 1))?.title).toBe(lesson.title);
    });

    it("updates a version in place, e.g. after review", async () => {
      await repos.lessons.save({
        ...lesson,
        reviewStatus: "needs-review",
        reviewedAt: undefined,
        reviewedBy: undefined,
      });
      await repos.lessons.save(lesson);

      expect((await repos.lessons.get(lesson.lessonId, 1))?.reviewStatus).toBe("approved");
    });

    it("finds lessons by intent signature", async () => {
      await repos.lessons.save(lesson);
      expect(await repos.lessons.findByIntent(lesson.reuse.intentSignature)).toHaveLength(1);
      expect(await repos.lessons.findByIntent("no-match")).toEqual([]);
    });

    it("rejects invalid lessons before writing", async () => {
      await expect(repos.lessons.save({ ...lesson, sections: [] })).rejects.toThrow();
      expect(await repos.lessons.get(lesson.lessonId, lesson.version)).toBeUndefined();
    });
  });

  describe("evidence", () => {
    it("stores sources and claims and fetches them in bulk", async () => {
      const source = fixture(EvidenceSource, "evidence-source", "institution-page");
      const claim = fixture(Claim, "claim", "supported");
      await repos.evidenceSources.save(source);
      await repos.claims.save(claim);

      expect(await repos.evidenceSources.get(source.sourceId)).toEqual(source);
      expect(await repos.claims.getMany([claim.claimId, "missing"])).toEqual([claim]);
      expect(await repos.claims.getMany([])).toEqual([]);
    });
  });

  describe("visual assets", () => {
    it("round-trips an asset rights record", async () => {
      const asset = fixture(VisualAsset, "visual-asset", "curated-glb");
      await repos.visualAssets.save(asset);
      expect(await repos.visualAssets.get(asset.assetId)).toEqual(asset);
    });
  });

  describe("recognition results", () => {
    const result = fixture(RecognitionResult, "recognition-result", "confirmed-top-candidate");

    it("lists results by session", async () => {
      await repos.recognitionResults.save(result);
      expect(await repos.recognitionResults.listBySession(result.sessionId)).toEqual([result]);
    });

    it("deletes only results past their deadline", async () => {
      await repos.recognitionResults.save(result);
      expect(await repos.recognitionResults.deleteExpired(new Date("2026-10-28T09:59:59Z"))).toBe(
        0,
      );
      expect(await repos.recognitionResults.deleteExpired(new Date("2026-10-28T10:00:00Z"))).toBe(
        1,
      );
      expect(await repos.recognitionResults.listBySession(result.sessionId)).toEqual([]);
    });
  });

  describe("tutor turns", () => {
    it("lists and deletes a session's turns", async () => {
      const turn = fixture(TutorTurn, "tutor-turn", "grounded-answer");
      await repos.tutorTurns.save(turn);
      const second = { ...turn, turnId: newId(), createdAt: "2026-10-27T10:06:00Z" };
      await repos.tutorTurns.save(second);

      expect((await repos.tutorTurns.listBySession(turn.sessionId)).map((t) => t.turnId)).toEqual([
        turn.turnId,
        second.turnId,
      ]);
      expect(await repos.tutorTurns.deleteBySession(turn.sessionId)).toBe(2);
    });
  });

  describe("media retention", () => {
    const now = new Date("2026-02-01T00:00:00Z");
    const policy = { derivativeTtlDays: 30, logTtlDays: 90, originalTtlDays: 7 };

    it("lists expired objects per kind and skips saved originals", async () => {
      await repos.mediaRegistry.save({
        createdAt: new Date("2026-01-20T00:00:00Z"),
        key: "uploads/old.jpg",
        kind: "original",
        savedByUser: false,
      });
      await repos.mediaRegistry.save({
        createdAt: new Date("2026-01-20T00:00:00Z"),
        key: "uploads/kept.jpg",
        kind: "original",
        savedByUser: true,
      });
      await repos.mediaRegistry.save({
        createdAt: new Date("2026-01-31T00:00:00Z"),
        key: "uploads/fresh.jpg",
        kind: "original",
        savedByUser: false,
      });

      const expired = await repos.mediaRegistry.listExpired(now, policy);
      expect(expired.map((item) => item.key)).toEqual(["uploads/old.jpg"]);

      await repos.mediaRegistry.remove(["uploads/old.jpg"]);
      await repos.deletionAudit.record({
        deletedAt: now,
        key: "uploads/old.jpg",
        kind: "original",
        reason: "original older than 7 days",
      });
      expect(await repos.mediaRegistry.listExpired(now, policy)).toEqual([]);
    });
  });
});
