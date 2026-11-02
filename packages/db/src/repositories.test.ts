import { join } from "node:path";
import {
  Claim,
  EvidenceSource,
  Lesson,
  newId,
  RecognitionResult,
  TutorTurn,
  VisualAsset,
  VisualManifest,
  type Lesson as LessonRecord,
} from "@sbi/contracts";
import { DuplicateSourceError } from "@sbi/evidence";
import { loadFixtures } from "@sbi/testing";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type DatabaseHandle } from "./client";
import { runMigrations } from "./migrate";
import { createRepositories, type Repositories } from "./repositories";
import { mediaObjects } from "./schema";

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
  "visual_manifests",
  "recognition_results",
  "tutor_turns",
  "media_objects",
  "deletion_audit_log",
  "catalog_gaps",
  "claim_dependencies",
  "claim_sources",
  "lesson_claims",
  "lesson_review_events",
  "evidence_packs",
  "lesson_feedback",
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

    it("finds every version that shows a claim, and forgets claims a version dropped", async () => {
      const [first, second] = lesson.claims;
      const v2: LessonRecord = { ...lesson, version: 2 };
      await repos.lessons.save(lesson);
      await repos.lessons.save(v2);

      const found = await repos.lessons.findByClaimIds([first?.claimId ?? "", "missing"]);
      expect(found.map((item) => item.version)).toEqual([2, 1]);
      expect(await repos.lessons.findByClaimIds([])).toEqual([]);

      if (second) {
        const trimmed = { ...v2, claims: lesson.claims.filter((claim) => claim !== second) };
        const sections = trimmed.sections.map((section) => ({
          ...section,
          claimIds: section.claimIds.filter((id) => id !== second.claimId),
        }));
        await repos.lessons.save({ ...trimmed, sections });
        const stillShown = await repos.lessons.findByClaimIds([second.claimId]);
        expect(stillShown.map((item) => item.version)).toEqual([1]);
      }
    });

    it("finds lessons by intent signature", async () => {
      await repos.lessons.save(lesson);
      expect(await repos.lessons.findByIntent(lesson.reuse.intentSignature)).toHaveLength(1);
      expect(await repos.lessons.findByIntent("no-match")).toEqual([]);
    });

    it("finds lessons by taxonomy category", async () => {
      await repos.lessons.save(lesson);
      expect(await repos.lessons.findByTaxonomy(lesson.taxonomyId)).toHaveLength(1);
      expect(await repos.lessons.findByTaxonomy("no-match")).toEqual([]);
    });

    it("rejects invalid lessons before writing", async () => {
      await expect(repos.lessons.save({ ...lesson, sections: [] })).rejects.toThrow();
      expect(await repos.lessons.get(lesson.lessonId, lesson.version)).toBeUndefined();
    });
  });

  describe("evidence packs", () => {
    it("stores a pack by key and replaces it on regather", async () => {
      const pack = {
        packKey: "a".repeat(64),
        taxonomyId: "object.electric-kettle",
        planVersion: "muse-spark-1.3+inquiry-plan-p0.1",
        createdAt: "2026-10-29T09:00:00.000Z",
        questions: [
          {
            key: "q1",
            discipline: "physics" as const,
            question: "How does current heat a wire?",
            claimIds: [newId()],
            sources: 3,
            failures: [],
            completed: true,
          },
        ],
      };
      await repos.evidencePacks.save(pack);
      expect(await repos.evidencePacks.get(pack.packKey)).toEqual(pack);
      const regathered = { ...pack, createdAt: "2026-11-02T09:00:00.000Z" };
      await repos.evidencePacks.save(regathered);
      expect((await repos.evidencePacks.get(pack.packKey))?.createdAt).toBe(regathered.createdAt);
      expect(await repos.evidencePacks.get("b".repeat(64))).toBeUndefined();
    });

    it("deletes packs gathered before the cutoff", async () => {
      const base = {
        taxonomyId: "object.electric-kettle",
        planVersion: "muse-spark-1.3+inquiry-plan-p0.1",
        questions: [],
      };
      await repos.evidencePacks.save({
        ...base,
        packKey: "c".repeat(64),
        createdAt: "2026-09-01T00:00:00.000Z",
      });
      await repos.evidencePacks.save({
        ...base,
        packKey: "d".repeat(64),
        createdAt: "2026-10-30T00:00:00.000Z",
      });
      expect(await repos.evidencePacks.deleteCreatedBefore(new Date("2026-10-01T00:00:00Z"))).toBe(
        1,
      );
      expect(await repos.evidencePacks.get("c".repeat(64))).toBeUndefined();
      expect(await repos.evidencePacks.get("d".repeat(64))).toBeDefined();
    });
  });

  describe("review audit", () => {
    it("stores each move in order, per version, with reviewer and time", async () => {
      const lessonId = newId();
      const move = (version: number, from: string, to: string, by: string, at: string) =>
        repos.reviewAudit.record({
          lessonId,
          version,
          from: from as never,
          to: to as never,
          by,
          at,
          ...(to === "needs-review" ? { reason: "x".repeat(3000) } : {}),
        });
      await move(1, "generated", "needs-review", "system", "2026-10-29T10:00:00.000Z");
      await move(1, "needs-review", "approved", "editor-7", "2026-10-29T11:00:00.000Z");
      await move(2, "generated", "auto-validated", "system", "2026-10-30T09:00:00.000Z");

      const first = await repos.reviewAudit.history(lessonId, 1);
      expect(first.map(({ to, by, at }) => ({ to, by, at }))).toEqual([
        { to: "needs-review", by: "system", at: "2026-10-29T10:00:00.000Z" },
        { to: "approved", by: "editor-7", at: "2026-10-29T11:00:00.000Z" },
      ]);
      expect(first[0]?.reason).toHaveLength(2000);
      expect(await repos.reviewAudit.history(lessonId)).toHaveLength(3);
    });
  });

  describe("lesson feedback", () => {
    it("stores reports and ratings per lesson version, oldest first", async () => {
      const lessonId = newId();
      await repos.lessonFeedback.record(
        { lessonId, version: 1, report: { category: "wrong-fact", details: "Step 2 is wrong." } },
        new Date("2026-10-30T10:00:00.000Z"),
      );
      await repos.lessonFeedback.record(
        { lessonId, version: 1, rating: { helpful: 4, clear: 2 } },
        new Date("2026-10-30T11:00:00.000Z"),
      );
      await repos.lessonFeedback.record(
        { lessonId, version: 2, report: { category: "unclear" }, rating: { helpful: 3, clear: 3 } },
        new Date("2026-10-30T12:00:00.000Z"),
      );

      const first = await repos.lessonFeedback.forLesson(lessonId, 1);
      expect(
        first.map(({ report, rating, receivedAt }) => ({ report, rating, receivedAt })),
      ).toEqual([
        {
          report: { category: "wrong-fact", details: "Step 2 is wrong." },
          rating: undefined,
          receivedAt: "2026-10-30T10:00:00.000Z",
        },
        {
          report: undefined,
          rating: { helpful: 4, clear: 2 },
          receivedAt: "2026-10-30T11:00:00.000Z",
        },
      ]);
      expect(await repos.lessonFeedback.forLesson(lessonId)).toHaveLength(3);
    });

    it("clears free text past retention but keeps categories and ratings", async () => {
      const lessonId = newId();
      await repos.lessonFeedback.record(
        { lessonId, version: 1, report: { category: "other", details: "My name is Sam." } },
        new Date("2026-07-01T10:00:00.000Z"),
      );
      await repos.lessonFeedback.record(
        { lessonId, version: 1, report: { category: "unclear", details: "Step 3?" } },
        new Date("2026-10-30T10:00:00.000Z"),
      );
      expect(
        await repos.lessonFeedback.clearDetailsBefore(new Date("2026-08-01T00:00:00.000Z")),
      ).toBe(1);
      const rows = await repos.lessonFeedback.forLesson(lessonId);
      expect(rows.map((row) => row.report)).toEqual([
        { category: "other" },
        { category: "unclear", details: "Step 3?" },
      ]);
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

    it("finds a source by DOI or URL and deletes it", async () => {
      const page = fixture(EvidenceSource, "evidence-source", "institution-page");
      const paper = fixture(EvidenceSource, "evidence-source", "paper-with-doi");
      await repos.evidenceSources.save(page);
      await repos.evidenceSources.save(paper);

      expect(await repos.evidenceSources.findByLocator({ doi: paper.doi?.toUpperCase() })).toEqual(
        paper,
      );
      expect(await repos.evidenceSources.findByLocator({ url: `${page.url}#top` })).toEqual(page);

      expect(await repos.evidenceSources.delete(page.sourceId)).toBe(true);
      expect(await repos.evidenceSources.findByLocator({ url: page.url })).toBeUndefined();
      expect(await repos.evidenceSources.delete(page.sourceId)).toBe(false);
    });

    it("refuses a second record for the same DOI and keeps the first intact", async () => {
      const paper = fixture(EvidenceSource, "evidence-source", "paper-with-doi");
      await repos.evidenceSources.save(paper);
      const copy = { ...paper, sourceId: "0192f1a0-0000-7000-8000-0000000000ee", title: "Copy" };
      await expect(repos.evidenceSources.save(copy)).rejects.toBeInstanceOf(DuplicateSourceError);
      expect(await repos.evidenceSources.get(paper.sourceId)).toEqual(paper);
      expect(await repos.evidenceSources.get(copy.sourceId)).toBeUndefined();

      await repos.evidenceSources.save({ ...paper, title: "Renamed" });
      expect((await repos.evidenceSources.get(paper.sourceId))?.title).toBe("Renamed");
    });

    it("rejects a source without rights status before writing", async () => {
      const page = fixture(EvidenceSource, "evidence-source", "institution-page");
      const unlicensed: Partial<EvidenceSource> = { ...page, rightsStatus: undefined };
      await expect(repos.evidenceSources.save(unlicensed as EvidenceSource)).rejects.toThrow();
      expect(await repos.evidenceSources.get(page.sourceId)).toBeUndefined();
    });

    it("finds dependents and citing claims through the edge tables", async () => {
      const base = fixture(Claim, "claim", "supported");
      const dependent = fixture(Claim, "claim", "qualified-with-dependency");
      await repos.claims.save(base);
      await repos.claims.save(dependent);

      expect(await repos.claims.findDependents(base.claimId)).toEqual([dependent]);
      const cited = await repos.claims.findBySource(base.sourceIds[1] ?? "");
      expect(cited).toEqual([base]);

      await repos.claims.save({ ...dependent, dependsOn: [] });
      expect(await repos.claims.findDependents(base.claimId)).toEqual([]);
      await repos.claims.delete(base.claimId);
      expect(await repos.claims.findBySource(base.sourceIds[0] ?? "")).toHaveLength(1);
    });

    it("lists sources due for a re-check, oldest first", async () => {
      const page = fixture(EvidenceSource, "evidence-source", "institution-page");
      const paper = fixture(EvidenceSource, "evidence-source", "paper-with-doi");
      await repos.evidenceSources.save({ ...page, lastCheckedAt: "2026-09-01T00:00:00Z" });
      await repos.evidenceSources.save({ ...paper, lastCheckedAt: "2026-08-01T00:00:00Z" });

      const due = await repos.evidenceSources.listDueForCheck(new Date("2026-09-15T00:00:00Z"), 10);
      expect(due.map((source) => source.sourceId)).toEqual([paper.sourceId, page.sourceId]);
      expect(
        await repos.evidenceSources.listDueForCheck(new Date("2026-08-15T00:00:00Z"), 10),
      ).toHaveLength(1);
      expect(
        await repos.evidenceSources.listDueForCheck(new Date("2026-09-15T00:00:00Z"), 1),
      ).toHaveLength(1);
    });

    it("finds claims by the judge version that verified them", async () => {
      const verified = fixture(Claim, "claim", "verified-by-judge");
      const unverified = fixture(Claim, "claim", "supported");
      await repos.claims.save(verified);
      await repos.claims.save(unverified);
      const judge = verified.verification?.judge ?? "";
      expect(await repos.claims.findByJudge(judge)).toEqual([verified]);
      expect(await repos.claims.findByJudge("other+p0")).toEqual([]);
    });

    it("deletes a claim", async () => {
      const claim = fixture(Claim, "claim", "supported");
      await repos.claims.save(claim);
      expect(await repos.claims.delete(claim.claimId)).toBe(true);
      expect(await repos.claims.get(claim.claimId)).toBeUndefined();
    });
  });

  describe("visual assets", () => {
    it("round-trips an asset rights record", async () => {
      const asset = fixture(VisualAsset, "visual-asset", "curated-glb");
      await repos.visualAssets.save(asset);
      expect(await repos.visualAssets.get(asset.assetId)).toEqual(asset);
    });
  });

  describe("visual manifests", () => {
    it("round-trips a manifest and replaces it on save", async () => {
      const manifest = fixture(VisualManifest, "visual-manifest", "process");
      await repos.visualManifests.save(manifest);
      await repos.visualManifests.save({ ...manifest, alt: "Kettle, redrawn" });
      expect(await repos.visualManifests.get(manifest.visualId)).toEqual({
        ...manifest,
        alt: "Kettle, redrawn",
      });
      expect(await repos.visualManifests.get(newId())).toBeUndefined();
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

    it("finds the newest unexpired result for a photo", async () => {
      const newer = {
        ...result,
        resultId: "0192f1a0-0000-7000-9000-0000000000aa",
        createdAt: "2026-10-27T11:00:00Z",
      };
      await repos.recognitionResults.save(result);
      await repos.recognitionResults.save(newer);

      const found = await repos.recognitionResults.findByImage(
        result.imageSha256,
        new Date("2026-10-28T09:00:00Z"),
      );
      expect(found?.resultId).toBe(newer.resultId);
      expect(
        await repos.recognitionResults.findByImage(
          result.imageSha256,
          new Date("2026-10-28T10:00:00Z"),
        ),
      ).toBeUndefined();
      expect(
        await repos.recognitionResults.findByImage(
          "c".repeat(64),
          new Date("2026-10-27T00:00:00Z"),
        ),
      ).toBeUndefined();
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

  describe("catalog gaps", () => {
    it("counts repeat terms per source and lists the most common first", async () => {
      const first = new Date("2026-10-28T10:00:00.000Z");
      const later = new Date("2026-10-28T11:00:00.000Z");
      await repos.catalogGaps.record("penny farthing", "observation", first);
      await repos.catalogGaps.record("penny farthing", "observation", later);
      await repos.catalogGaps.record("lava lamp", "recognition-label", first);

      expect(await repos.catalogGaps.top(5)).toEqual([
        {
          count: 2,
          firstSeen: first,
          lastSeen: later,
          source: "observation",
          term: "penny farthing",
        },
        {
          count: 1,
          firstSeen: first,
          lastSeen: first,
          source: "recognition-label",
          term: "lava lamp",
        },
      ]);
    });

    it("forgets terms nobody has used since the cutoff", async () => {
      await repos.catalogGaps.record("old term", "observation", new Date("2025-01-01T00:00:00Z"));
      await repos.catalogGaps.record("new term", "observation", new Date("2026-10-28T00:00:00Z"));
      expect(await repos.catalogGaps.deleteLastSeenBefore(new Date("2026-01-01T00:00:00Z"))).toBe(
        1,
      );
      expect((await repos.catalogGaps.top(5)).map((gap) => gap.term)).toEqual(["new term"]);
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

    it("deletes old turns of one retention class only", async () => {
      const turn = fixture(TutorTurn, "tutor-turn", "grounded-answer");
      const old = {
        ...turn,
        retentionClass: "session" as const,
        createdAt: "2026-10-01T10:00:00Z",
      };
      const recent = { ...old, turnId: newId(), createdAt: "2026-10-30T10:00:00Z" };
      const review = { ...old, turnId: newId(), retentionClass: "quality-review" as const };
      for (const item of [old, recent, review]) await repos.tutorTurns.save(item);
      const cutoff = new Date("2026-10-15T00:00:00Z");
      expect(await repos.tutorTurns.deleteCreatedBefore("session", cutoff)).toBe(1);
      expect(
        (await repos.tutorTurns.listBySession(turn.sessionId)).map((t) => t.turnId).sort(),
      ).toEqual([recent.turnId, review.turnId].sort());
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
      expect(await repos.mediaRegistry.keep("photos/kept.jpg", "consent-1")).toBe(true);

      const expired = await repos.mediaRegistry.listExpired(now, 10);
      expect(expired.map((item) => item.key)).toEqual(["photos/late.jpg", "photos/on-time.jpg"]);
      expect(await repos.mediaRegistry.listExpired(now, 1)).toHaveLength(1);
    });

    it("lets a keep win before the claim and lose after it", async () => {
      await repos.mediaRegistry.register(original("photos/a.jpg", now));
      await repos.mediaRegistry.register(original("photos/b.jpg", now));

      expect(await repos.mediaRegistry.keep("photos/a.jpg", "consent-1")).toBe(true);
      expect(await repos.mediaRegistry.keep("photos/a.jpg", "consent-1")).toBe(true);
      expect(await repos.mediaRegistry.claimForDeletion("photos/a.jpg", now)).toBe(false);

      expect(await repos.mediaRegistry.claimForDeletion("photos/b.jpg", now)).toBe(true);
      expect(await repos.mediaRegistry.keep("photos/b.jpg", "consent-1")).toBe(false);
      expect(await repos.mediaRegistry.claimForDeletion("photos/b.jpg", at(60_000))).toBe(true);
      await repos.mediaRegistry.forget("photos/b.jpg");
      expect(await repos.mediaRegistry.claimForDeletion("photos/b.jpg", now)).toBe(false);
    });

    it("records the consent a photo was kept under, and releases it for deletion", async () => {
      await repos.mediaRegistry.register(original("photos/kept.jpg", at(86_400_000)));
      await repos.mediaRegistry.keep("photos/kept.jpg", "consent-1");
      const [kept] = await handle.db
        .select({ consentVersion: mediaObjects.consentVersion })
        .from(mediaObjects)
        .where(eq(mediaObjects.objectKey, "photos/kept.jpg"));
      expect(kept?.consentVersion).toBe("consent-1");

      expect(await repos.mediaRegistry.release("photos/kept.jpg", now)).toBe(true);
      expect((await repos.mediaRegistry.listExpired(now, 10)).map((item) => item.key)).toEqual([
        "photos/kept.jpg",
      ]);
      expect(await repos.mediaRegistry.release("photos/kept.jpg", now)).toBe(true);
      expect(await repos.mediaRegistry.release("photos/gone.jpg", now)).toBe(false);
    });

    it("only brings expiry forward, and never for a kept photo", async () => {
      await repos.mediaRegistry.register(original("photos/a.jpg", at(86_400_000)));
      await repos.mediaRegistry.register(original("photos/kept.jpg", at(86_400_000)));
      await repos.mediaRegistry.keep("photos/kept.jpg", "consent-1");

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
