import { HttpStatus } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { Lesson, type Claim, type Lesson as LessonType, type LessonRequest } from "@sbi/contracts";
import {
  buildClaims,
  createMemoryEvidenceRepositories,
  saveClaimGraph,
  type EvidenceRepositories,
  type FetchedSource,
} from "@sbi/evidence";
import { LlmError, type Completion, type CompletionRequest, type LlmProvider } from "@sbi/llm";
import {
  createMemoryReviewAuditLog,
  type LessonRepository,
  type TaxonomyLessonLookup,
} from "@sbi/orchestrator";
import { createTaxonomy, type Taxonomy } from "@sbi/taxonomy";
import { UserFacingException } from "../common/user-facing.exception";
import {
  effectiveSafetyClass,
  LESSON_POLICY_VERSION,
  LessonService,
  type LessonStreamEvent,
} from "./lesson.service";

const REQUEST: LessonRequest = {
  question: "Why does my kettle click off?",
  taxonomyId: "test.kettle",
  audience: "general",
  readingLevel: "plain",
  locale: "en-GB",
  safetyClass: "low",
  assumptions: [],
  fresh: false,
};

function page(publisher: string, url: string): FetchedSource {
  return {
    title: publisher,
    publisher,
    authors: [],
    url,
    sourceType: "institution",
    passages: [{ location: "paragraph 1", text: "Bimetallic thermostats snap open when hot." }],
    rightsStatus: "reusable",
    retrieval: {
      connector: "us-gov",
      fetchedAt: "2026-10-29T09:00:00.000Z",
      access: "full-text",
      contentSha256: "c".repeat(64),
    },
  };
}

// One claim backed by two independent agencies, stored as the evidence check expects.
async function evidenceStore(): Promise<{ evidence: EvidenceRepositories; claim: Claim }> {
  const evidence = createMemoryEvidenceRepositories();
  const built = await buildClaims(
    [{ key: "snap", text: "Bimetallic thermostats snap open when hot.", scope: "kettles" }],
    [page("USGS", "https://www.usgs.gov/a"), page("NIST", "https://www.nist.gov/b")],
    { judge: { version: "t", judge: async () => ({ verdict: "supports", reason: "ok" }) } },
  );
  const { claims } = await saveClaimGraph(evidence, built);
  const claim = claims[0];
  if (!claim) throw new Error("fixture claim was not built");
  return { evidence, claim };
}

const EVIDENCE = await evidenceStore();
const CLAIM_A = EVIDENCE.claim.claimId;

function taxonomy(): Taxonomy {
  return createTaxonomy([
    { id: "test.home", kind: "category", label: "Home" },
    {
      id: "test.kettle",
      kind: "object",
      label: "Kettle",
      parentId: "test.home",
      concepts: ["heat transfer"],
      facts: [{ scope: "category", text: "Thermostats snap open when hot.", claimId: CLAIM_A }],
    },
    {
      id: "category.household-chemicals",
      kind: "category",
      label: "Household chemicals",
    },
    {
      id: "object.cleaning-products",
      kind: "object",
      label: "Cleaning products",
      parentId: "category.household-chemicals",
      concepts: ["acids and bases"],
      facts: [{ scope: "category", text: "Thermostats snap open when hot.", claimId: CLAIM_A }],
    },
  ]);
}

const FRAGMENT = {
  title: "Why kettles click off",
  summary: "A thermostat snaps the kettle off.",
  learningObjectives: ["Explain the click"],
  sections: [
    { module: "what-youre-seeing", text: "The switch flips up.", claimIds: [CLAIM_A] },
    { module: "short-answer", text: "Heat snaps a small switch.", claimIds: [CLAIM_A] },
    { module: "first-principles", text: "Metals bend as they warm.", claimIds: [CLAIM_A] },
  ],
};

const SUPPORTS = JSON.stringify({ verdict: "supports", reason: "Claims state it." });
const CONTRADICTS = JSON.stringify({ verdict: "contradicts", reason: "Section flips the cause." });
const AGREE = JSON.stringify({ contradiction: false, reason: "", claimIds: [] });

// Routes by prompt shape so parallel judge calls cannot steal each other's verdicts.
function scriptedProvider(options: { entailment?: string } = {}): LlmProvider {
  const calls: CompletionRequest[] = [];
  const provider: LlmProvider & { calls: CompletionRequest[] } = {
    id: "stub",
    model: "stub-1",
    calls,
    async complete(request: CompletionRequest): Promise<Completion> {
      calls.push(request);
      const text = JSON.stringify(request.messages);
      const payload = text.includes("<question-")
        ? JSON.stringify(FRAGMENT)
        : text.includes("<section-")
          ? (options.entailment ?? SUPPORTS)
          : AGREE;
      return {
        text: payload,
        model: "stub-1",
        usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
        latencyMs: 0,
        prompt: request.prompt,
      };
    },
  };
  return provider;
}

function throwingProvider(error: Error): LlmProvider {
  return {
    id: "stub",
    model: "stub-1",
    async complete(): Promise<Completion> {
      throw error;
    },
  };
}

function memoryLessons(stored: LessonType[] = []) {
  const lessons = [...stored];
  const repo: LessonRepository & TaxonomyLessonLookup = {
    async save(lesson) {
      lessons.push(lesson);
    },
    async get(lessonId, version) {
      return lessons.find((lesson) => lesson.lessonId === lessonId && lesson.version === version);
    },
    async latest(lessonId) {
      return lessons.filter((lesson) => lesson.lessonId === lessonId).at(-1);
    },
    async findByIntent(signature) {
      return lessons.filter((lesson) => lesson.reuse.intentSignature === signature);
    },
    async findByClaimIds(claimIds) {
      return lessons.filter((lesson) =>
        lesson.claims.some((claim) => claimIds.includes(claim.claimId)),
      );
    },
    async findByTaxonomy(taxonomyId) {
      return lessons.filter((lesson) => lesson.taxonomyId === taxonomyId);
    },
  };
  return { lessons, repo };
}

function setup(provider: LlmProvider | null, stored: LessonType[] = []) {
  const { lessons, repo } = memoryLessons(stored);
  const audit = createMemoryReviewAuditLog();
  return {
    lessons,
    audit,
    service: new LessonService(provider, taxonomy(), repo, EVIDENCE.evidence, audit),
  };
}

async function collect(
  target: LessonService,
  request: LessonRequest = REQUEST,
): Promise<LessonStreamEvent[]> {
  const events: LessonStreamEvent[] = [];
  for await (const event of target.streamLesson(request)) events.push(event);
  return events;
}

async function userFacing(
  run: () => Promise<unknown>,
): Promise<{ status: number; message: string }> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(UserFacingException);
    const facing = error as UserFacingException;
    return { status: facing.getStatus(), message: facing.message };
  }
  throw new Error("Expected a user-facing error");
}

describe("LessonService", () => {
  it("streams the quick answer before the full lesson and visuals", async () => {
    const { lessons, service } = setup(scriptedProvider());

    const events = await collect(service);

    expect(events.map((event) => event.type)).toEqual(["quick-answer", "lesson", "visuals"]);
    const [answer, full, visuals] = events;
    expect(answer?.type).toBe("quick-answer");
    if (answer?.type !== "quick-answer") throw new Error("First event must answer first");
    expect(answer.data).toMatchObject({
      kind: "fresh",
      title: "Why kettles click off",
      shortAnswer: "Heat snaps a small switch.",
      reviewStatus: "auto-validated",
    });
    expect(answer.data.note).toBeUndefined();
    if (full?.type !== "lesson") throw new Error("Second event must be the lesson");
    expect(() => Lesson.parse(full.data)).not.toThrow();
    expect(full.data.reuse.policyVersion).toBe(LESSON_POLICY_VERSION);
    expect(visuals).toMatchObject({ type: "visuals", data: { visuals: [] } });
    expect(lessons).toHaveLength(1);
  });

  it("stores the review trail for served and held lessons", async () => {
    const served = setup(scriptedProvider());
    await collect(served.service);
    const lesson = served.lessons[0];
    expect(
      (await served.audit.history(lesson?.lessonId ?? "")).map(({ from, to, by }) => ({
        from,
        to,
        by,
      })),
    ).toEqual([{ from: "generated", to: "auto-validated", by: "system" }]);

    const held = setup(scriptedProvider({ entailment: CONTRADICTS }));
    await userFacing(() => collect(held.service));
    const [move] = await held.audit.history(held.lessons[0]?.lessonId ?? "");
    expect(move).toMatchObject({ from: "generated", to: "needs-review", by: "system" });
    expect(move?.reason).toContain("entailment");
  });

  it("serves aligned shared lessons from cache without calling the provider", async () => {
    const first = setup(scriptedProvider());
    await collect(first.service);
    share(first.lessons);
    const provider = throwingProvider(new Error("must not be called"));
    const { service: cached } = setup(provider, first.lessons);

    const events = await collect(cached);

    expect(events.map((event) => event.type)[0]).toBe("quick-answer");
    if (events[0]?.type !== "quick-answer") throw new Error("First event must answer first");
    expect(events[0].data.kind).toBe("cached");
  });

  it("regenerates on a fresh-answer override", async () => {
    const first = setup(scriptedProvider());
    await collect(first.service);
    share(first.lessons);
    const provider = throwingProvider(new LlmError("stub: timed out after 20ms"));
    const { service: fresh } = setup(provider, first.lessons);

    const events = await collect(fresh, { ...REQUEST, fresh: true });

    if (events[0]?.type !== "quick-answer") throw new Error("First event must answer first");
    expect(events[0].data.kind).toBe("fallback");
    expect(events[0].data.note).toContain("cached lesson");
  });

  it("falls back to a category lesson on provider timeout", async () => {
    const seeded = Lesson.parse({
      ...firstLesson(),
      reviewStatus: "auto-validated",
      reuse: { ...firstLesson().reuse, intentSignature: "other" },
    });
    const provider = throwingProvider(new LlmError("stub: timed out after 20ms"));
    const { service: target } = setup(provider, [seeded]);

    const events = await collect(target);

    if (events[0]?.type !== "quick-answer") throw new Error("First event must answer first");
    expect(events[0].data.kind).toBe("fallback");
    expect(events).toHaveLength(3);
  });

  it("asks for a retry when timeouts leave no fallback", async () => {
    const provider = throwingProvider(new LlmError("stub: timed out after 20ms"));
    const { service: target } = setup(provider);

    const failure = await userFacing(() => collect(target));

    expect(failure.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(failure.message).toContain("timed out");
  });

  it("holds a draft the judges reject for review instead of serving it", async () => {
    const { lessons, service: target } = setup(scriptedProvider({ entailment: CONTRADICTS }));

    const failure = await userFacing(() => collect(target));

    expect(failure.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(failure.message).toContain("reviewer needs to check");
    expect(lessons.map((lesson) => lesson.reviewStatus)).toEqual(["needs-review"]);
  });

  it("never serves another learner's private lesson from cache or as a fallback", async () => {
    const first = setup(scriptedProvider());
    await collect(first.service);
    const { service: next } = setup(
      throwingProvider(new LlmError("stub: timed out after 20ms")),
      first.lessons,
    );

    const failure = await userFacing(() => collect(next));

    expect(failure.message).toContain("timed out");
  });

  it("holds a lesson on a high-risk topic for review even when the client says low", async () => {
    const { lessons, service: target } = setup(scriptedProvider());

    const failure = await userFacing(() =>
      collect(target, { ...REQUEST, taxonomyId: "object.cleaning-products", safetyClass: "low" }),
    );

    expect(failure.message).toContain("reviewer needs to check");
    expect(lessons[0]).toMatchObject({ safetyClass: "high", reviewStatus: "needs-review" });
  });

  it("holds a draft whose cited excerpt has gone stale", async () => {
    // A copy of the shared store, with the cited source reported gone by the freshness check.
    const evidence = createMemoryEvidenceRepositories();
    const claim = EVIDENCE.claim;
    for (const source of await EVIDENCE.evidence.sources.getMany(claim.sourceIds)) {
      await evidence.sources.save({
        ...source,
        freshness: { status: "gone", checkedAt: "2026-10-29T10:00:00Z", missingExcerptIds: [] },
      });
    }
    await evidence.claims.save(claim);
    const facts = createTaxonomy([
      { id: "test.home", kind: "category", label: "Home" },
      {
        id: "test.kettle",
        kind: "object",
        label: "Kettle",
        parentId: "test.home",
        concepts: ["heat transfer"],
        facts: [{ scope: "category", text: "Thermostats snap.", claimId: claim.claimId }],
      },
    ]);
    const { lessons, repo } = memoryLessons();
    const target = new LessonService(
      scriptedProvider(),
      facts,
      repo,
      evidence,
      createMemoryReviewAuditLog(),
    );

    const failure = await userFacing(() => collect(target));

    expect(failure.message).toContain("reviewer needs to check");
    expect(lessons[0]?.reviewStatus).toBe("needs-review");
  });

  it("answers 404 for unknown categories and uncovered ones", async () => {
    const { service: target } = setup(scriptedProvider());

    const unknown = await userFacing(() =>
      collect(target, { ...REQUEST, taxonomyId: "test.toaster" }),
    );
    expect(unknown.status).toBe(HttpStatus.NOT_FOUND);

    const bare = createTaxonomy([
      { id: "test.home", kind: "category", label: "Home" },
      {
        id: "test.rock",
        kind: "object",
        label: "Rock",
        parentId: "test.home",
        concepts: [],
        facts: [],
      },
    ]);
    const { repo } = memoryLessons();
    const uncovered = new LessonService(
      scriptedProvider(),
      bare,
      repo,
      createMemoryEvidenceRepositories(),
      createMemoryReviewAuditLog(),
    );
    const missing = await userFacing(() =>
      collect(uncovered, { ...REQUEST, taxonomyId: "test.rock" }),
    );
    expect(missing.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("answers 503 without a provider", async () => {
    const { service: target } = setup(null);

    const failure = await userFacing(() => collect(target));

    expect(failure.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  });
});

// Stands in for opt-in sharing (#104): only shared lessons may be reused or stand in.
function share(lessons: LessonType[]) {
  for (const lesson of lessons) lesson.reuse = { ...lesson.reuse, cacheScope: "shared" };
}

describe("effectiveSafetyClass", () => {
  it("raises flagged topics and their children to high, and never lowers a request", () => {
    expect(effectiveSafetyClass("low", { id: "object.mushroom" })).toBe("high");
    expect(
      effectiveSafetyClass("low", {
        id: "object.medicine-tablets",
        parentId: "category.household-chemicals",
      }),
    ).toBe("high");
    expect(effectiveSafetyClass("medium", { id: "object.bicycle" })).toBe("medium");
    expect(effectiveSafetyClass("low", { id: "object.bicycle" })).toBe("low");
  });
});

function firstLesson(): LessonType {
  return Lesson.parse({
    lessonId: "123e4567-e89b-12d3-a456-426614174020",
    version: 1,
    taxonomyId: "test.kettle",
    title: "Seeded lesson",
    locale: "en-GB",
    audience: ["general"],
    readingLevel: "plain",
    summary: "Seeded summary.",
    learningObjectives: ["Seeded objective"],
    assumptions: [],
    concepts: [{ conceptId: "heat-transfer", label: "heat transfer", prerequisites: [] }],
    misconceptionNotes: [],
    sections: [
      {
        sectionId: "short-answer-1",
        module: "short-answer",
        text: "Seeded answer.",
        claimIds: [CLAIM_A],
      },
      {
        sectionId: "what-youre-seeing-2",
        module: "what-youre-seeing",
        text: "Seeded seeing.",
        claimIds: [CLAIM_A],
      },
      {
        sectionId: "first-principles-3",
        module: "first-principles",
        text: "Seeded principles.",
        claimIds: [CLAIM_A],
      },
    ],
    claims: [EVIDENCE.claim],
    visuals: [],
    safetyClass: "low",
    reviewStatus: "auto-validated",
    reuse: {
      intentSignature: "seeded",
      matchDimensions: ["intent", "depth", "locale", "assumptions", "safety"],
      cacheScope: "shared",
      generatedAt: "2026-10-29T00:00:00.000Z",
      evidenceSnapshotId: "123e4567-e89b-12d3-a456-426614174003",
      sourceFreshness: "fresh",
      modelVersion: "stub-1",
      promptVersion: "lesson-draft@1",
      policyVersion: LESSON_POLICY_VERSION,
      reuseCount: 0,
      contentHash: "b".repeat(64),
    },
  });
}
