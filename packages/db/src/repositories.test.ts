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

    it("reads and updates a result by id", async () => {
      await repos.recognitionResults.save(result);
      const corrected = {
        ...result,
        selectedTaxonomyId: "household.kitchen.coffee-pot",
        userCorrection: {
          kind: "selected-alternative" as const,
          taxonomyId: "household.kitchen.coffee-pot",
        },
      };

      expect(await repos.recognitionResults.update(corrected)).toBe(true);
      expect(await repos.recognitionResults.get(result.resultId)).toEqual(corrected);
      expect(await repos.recognitionResults.get("0192f1a0-0000-7000-9000-0000000000ff")).toBe(
        undefined,
      );
      expect(
        await repos.recognitionResults.update({
          ...result,
          resultId: "0192f1a0-0000-7000-9000-0000000000ff",
        }),
      ).toBe(false);
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
    const at = (offsetMs: number) => new Date(now.getTime() + offsetMs);
    const original = (key: string, expiresAt: Date | null) => ({
      createdAt: at(-7 * 86_400_000),
      expiresAt,
      key,
      kind: "original" as const,
    });

    it("lists unsaved objects whose expiry has arrived, oldest first", async () => {
      await repos.mediaRegistry.register(original("photos/on-time.jpg", now));
      await repos.mediaRegistry.register(original("photos/late.jpg", at(-1000)));
      await repos.mediaRegistry.register(original("photos/fresh.jpg", at(1)));
      await repos.mediaRegistry.register(original("photos/kept.jpg", at(-1000)));
      expect(await repos.mediaRegistry.keep("photos/kept.jpg")).toBe(true);

      const expired = await repos.mediaRegistry.listExpired(now, 10);
      expect(expired.map((item) => item.key)).toEqual(["photos/late.jpg", "photos/on-time.jpg"]);
      expect(await repos.mediaRegistry.listExpired(now, 1)).toHaveLength(1);
    });

    it("lets a keep win before the claim and lose after it", async () => {
      await repos.mediaRegistry.register(original("photos/a.jpg", now));
      await repos.mediaRegistry.register(original("photos/b.jpg", now));

      expect(await repos.mediaRegistry.keep("photos/a.jpg")).toBe(true);
      expect(await repos.mediaRegistry.keep("photos/a.jpg")).toBe(true);
      expect(await repos.mediaRegistry.claimForDeletion("photos/a.jpg", now)).toBe(false);

      expect(await repos.mediaRegistry.claimForDeletion("photos/b.jpg", now)).toBe(true);
      expect(await repos.mediaRegistry.keep("photos/b.jpg")).toBe(false);
      expect(await repos.mediaRegistry.claimForDeletion("photos/b.jpg", at(60_000))).toBe(true);
      await repos.mediaRegistry.forget("photos/b.jpg");
      expect(await repos.mediaRegistry.claimForDeletion("photos/b.jpg", now)).toBe(false);
    });

    it("only brings expiry forward, and never for a kept photo", async () => {
      await repos.mediaRegistry.register(original("photos/a.jpg", at(86_400_000)));
      await repos.mediaRegistry.register(original("photos/kept.jpg", at(86_400_000)));
      await repos.mediaRegistry.keep("photos/kept.jpg");

      await repos.mediaRegistry.expireSooner("photos/a.jpg", at(3_600_000));
      await repos.mediaRegistry.expireSooner("photos/a.jpg", at(2 * 86_400_000));
      await repos.mediaRegistry.expireSooner("photos/kept.jpg", at(-1));

      expect(
        (await repos.mediaRegistry.listExpired(at(3_600_000), 10)).map((item) => item.key),
      ).toEqual(["photos/a.jpg"]);
    });

    it("ages out audit entries older than the cutoff", async () => {
      for (const deletedAt of [at(-2000), at(-1000), now]) {
        await repos.deletionAudit.record({
          deletedAt,
          key: "photos/a.jpg",
          kind: "original",
          reason: "test",
        });
      }
      expect(await repos.deletionAudit.purgeOlderThan(at(-500))).toBe(2);
      expect(await repos.deletionAudit.purgeOlderThan(at(-500))).toBe(0);
    });
  });

  describe("withLock", () => {
    it("lets only one holder run at a time and releases afterwards", async () => {
      let release: (() => void) | undefined;
      const blocked = new Promise<void>((resolve) => {
        release = resolve;
      });
      const first = handle.withLock("sbi-test-lock", async () => {
        await blocked;
        return "first";
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      const second = createDatabase(url ?? "");
      try {
        await expect(second.withLock("sbi-test-lock", async () => "second")).resolves.toEqual({
          acquired: false,
        });
        release?.();
        await expect(first).resolves.toEqual({ acquired: true, value: "first" });
        await expect(second.withLock("sbi-test-lock", async () => "second")).resolves.toEqual({
          acquired: true,
          value: "second",
        });
      } finally {
        await second.close();
      }
    });
  });
});
