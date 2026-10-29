import { HttpStatus } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { Lesson, type Claim, type Lesson as LessonType, type LessonRequest } from "@sbi/contracts";
import {
  buildClaims,
  createMemoryEvidenceRepositories,
  saveClaimGraph,
  type EvidencePack,
  type EvidenceRepositories,
  type FetchedSource,
  type GatherEvent,
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
  type EvidenceGatherer,
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
interface Script {
  entailment?: string;
  /** Verdict for the quick answer only; the lesson's sections use `entailment`. */
  quickEntailment?: string;
  /** Held open until the test releases it, to prove the answer streams first. */
  draftGate?: Promise<void>;
  /** When set, revised sections are judged as supported, so a repair succeeds. */
  revisionPasses?: boolean;
}

const REVISED = "Revised to state only what the claims support.";

const QUICK = "A warm metal strip bends and flips the switch off.";

// Routes by prompt id and shape so parallel calls cannot steal each other's answers.
function scriptedProvider(options: Script = {}): LlmProvider {
  return {
    id: "stub",
    model: "stub-1",
    async complete(request: CompletionRequest): Promise<Completion> {
      const text = JSON.stringify(request.messages);
      let payload: string;
      if (request.prompt?.id === "quick-answer") {
        payload = JSON.stringify({ text: QUICK, claimIds: [CLAIM_A] });
      } else if (request.prompt?.id === "lesson-revise") {
        payload = JSON.stringify({ text: REVISED });
      } else if (request.prompt?.id === "lesson-draft") {
        await options.draftGate;
        payload = JSON.stringify(FRAGMENT);
      } else if (text.includes("<section-") && options.revisionPasses && text.includes(REVISED)) {
        payload = SUPPORTS;
      } else if (text.includes("<section-")) {
        const quick = text.includes(QUICK) && options.quickEntailment;
        payload = quick ? (options.quickEntailment ?? SUPPORTS) : (options.entailment ?? SUPPORTS);
      } else {
        payload = AGREE;
      }
      return {
        text: payload,
        model: "stub-1",
        usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
        latencyMs: 0,
        prompt: request.prompt,
      };
    },
  };
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

// Replays the given gather events and returns the given claims, standing in for gatherEvidence.
function gatherer(claims: Claim[] = [], events: GatherEvent[] = []): EvidenceGatherer {
  return async (_input, options) => {
    for (const event of events) options.onEvent?.(event);
    return { claims, reused: false, pack: {} as EvidencePack };
  };
}

function setup(
  provider: LlmProvider | null,
  stored: LessonType[] = [],
  gather: EvidenceGatherer = gatherer(),
) {
  const { lessons, repo } = memoryLessons(stored);
  const audit = createMemoryReviewAuditLog();
  return {
    lessons,
    audit,
    service: new LessonService(provider, taxonomy(), repo, EVIDENCE.evidence, audit, gather),
  };
}

async function nextLessonEvent(stream: AsyncGenerator<LessonStreamEvent>) {
  for (;;) {
    const next = await stream.next();
    if (next.done || next.value.type !== "progress") return next;
  }
}

/** Lesson events only; progress events are covered by their own tests. */
async function collect(
  target: LessonService,
  request: LessonRequest = REQUEST,
): Promise<LessonStreamEvent[]> {
  return (await collectAll(target, request)).filter((event) => event.type !== "progress");
}

async function collectAll(
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
      shortAnswer: QUICK,
      claimIds: [CLAIM_A],
      reviewStatus: "auto-validated",
    });
    expect(answer.data.note).toBeUndefined();
    if (full?.type !== "lesson") throw new Error("Second event must be the lesson");
    expect(() => Lesson.parse(full.data)).not.toThrow();
    expect(full.data.reuse.policyVersion).toBe(LESSON_POLICY_VERSION);
    expect(visuals).toMatchObject({ type: "visuals", data: { visuals: [] } });
    expect(lessons).toHaveLength(1);
  });

  it("streams the checked short answer while the full draft is still being written", async () => {
    let release: () => void = () => undefined;
    const draftGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { service } = setup(scriptedProvider({ draftGate }));
    const stream = service.streamLesson(REQUEST);

    const first = await nextLessonEvent(stream);
    expect(first.value).toMatchObject({
      type: "quick-answer",
      data: {
        kind: "fresh",
        shortAnswer: QUICK,
        claimIds: [CLAIM_A],
        reviewStatus: "auto-validated",
      },
    });
    if (first.value?.type !== "quick-answer") throw new Error("expected the answer first");
    expect(first.value.data.title).toBeUndefined();

    release();
    const rest: LessonStreamEvent[] = [];
    for await (const event of stream) if (event.type !== "progress") rest.push(event);
    expect(rest.map((event) => event.type)).toEqual(["lesson", "visuals"]);
    const lesson = rest[0]?.type === "lesson" ? rest[0].data : undefined;
    expect(lesson?.lessonId).toBe(first.value.data.lessonId);
    expect(lesson?.sections.find((section) => section.module === "short-answer")?.text).toBe(QUICK);
  });

  it("falls back to the lesson's own short answer when the quick one fails its gate", async () => {
    const { service } = setup(scriptedProvider({ quickEntailment: CONTRADICTS }));
    const events = await collect(service);
    expect(events.map((event) => event.type)).toEqual(["quick-answer", "lesson", "visuals"]);
    if (events[0]?.type !== "quick-answer") throw new Error("expected the answer first");
    expect(events[0].data).toMatchObject({
      shortAnswer: "Heat snaps a small switch.",
      title: "Why kettles click off",
    });
  });

  it("ends the stream with a clear message when the lesson is held after the answer", async () => {
    const { service } = setup(
      scriptedProvider({ entailment: CONTRADICTS, quickEntailment: SUPPORTS }),
    );
    const stream = service.streamLesson(REQUEST);
    expect((await nextLessonEvent(stream)).value?.type).toBe("quick-answer");
    const failure = await userFacing(() => nextLessonEvent(stream));
    expect(failure.message).toContain("short answer above is checked");
    expect(failure.message).toContain("reviewer");
  });

  it("teaches an object with no pre-sourced facts from evidence gathered at request time", async () => {
    const bare = createTaxonomy([
      { id: "test.home", kind: "category", label: "Home" },
      { id: "test.kettle", kind: "object", label: "Kettle", parentId: "test.home" },
    ]);
    const { lessons, repo } = memoryLessons();
    const target = new LessonService(
      scriptedProvider(),
      bare,
      repo,
      EVIDENCE.evidence,
      createMemoryReviewAuditLog(),
      gatherer([EVIDENCE.claim]),
    );
    const events = await collect(target);
    expect(events.map((event) => event.type)).toEqual(["quick-answer", "lesson", "visuals"]);
    const lesson = events[1]?.type === "lesson" ? events[1].data : undefined;
    expect(lesson?.claims.map((claim) => claim.claimId)).toEqual([EVIDENCE.claim.claimId]);
    expect(lesson?.concepts.map((concept) => concept.label)).toEqual(["Kettle"]);
    expect(lessons).toHaveLength(1);
  });

  it("streams research progress and the first checked answer while evidence is gathered", async () => {
    const plan = {
      key: "q1",
      discipline: "physics" as const,
      question: "How does a bimetallic strip bend?",
      searchTerms: ["bimetallic strip"],
      wikipediaArticles: [],
      dependsOn: [],
    };
    const { service } = setup(
      scriptedProvider(),
      [],
      gatherer(
        [EVIDENCE.claim],
        [
          { type: "planned", questions: [plan] },
          { type: "verified", key: "q1", claims: [EVIDENCE.claim] },
        ],
      ),
    );
    const events = await collectAll(service);
    const types = events.map((event) =>
      event.type === "progress" ? `progress:${event.data.stage}` : event.type,
    );
    expect(types.slice(0, 4)).toEqual([
      "progress:researching",
      "progress:verified",
      "quick-answer",
      "progress:drafting",
    ]);
    expect(types).toContain("progress:checking");
    expect(types.slice(-2)).toEqual(["lesson", "visuals"]);
    const researching = events[0]?.type === "progress" ? events[0].data.message : "";
    expect(researching).toContain("How does a bimetallic strip bend?");
  });

  it("says no trusted sources were found when gathering finds nothing and no facts exist", async () => {
    const bare = createTaxonomy([
      { id: "test.home", kind: "category", label: "Home" },
      { id: "test.kettle", kind: "object", label: "Kettle", parentId: "test.home" },
    ]);
    const target = new LessonService(
      scriptedProvider(),
      bare,
      memoryLessons().repo,
      EVIDENCE.evidence,
      createMemoryReviewAuditLog(),
      gatherer([]),
    );
    const failure = await userFacing(() => collect(target));
    expect(failure.status).toBe(HttpStatus.NOT_FOUND);
    expect(failure.message).toContain("could not find trusted sources");
  });

  it("falls back to sourced taxonomy facts when gathering fails at the provider", async () => {
    const { service } = setup(scriptedProvider(), [], async () => {
      throw new LlmError("stub: timed out after 10ms");
    });
    const events = await collect(service);
    expect(events.map((event) => event.type)).toEqual(["quick-answer", "lesson", "visuals"]);
  });

  it("leaves disputed gathered claims out of the lesson", async () => {
    const disputed = {
      ...EVIDENCE.claim,
      claimId: "0192f1a0-0000-7000-8000-0000000000d1",
      status: "disputed" as const,
      uncertainty: "Sources disagree.",
    };
    const { service } = setup(scriptedProvider(), [], gatherer([disputed]));
    const events = await collect(service);
    const lesson = events.find((event) => event.type === "lesson");
    expect(
      lesson?.type === "lesson" && lesson.data.claims.map((claim) => claim.claimId),
    ).not.toContain(disputed.claimId);
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

  it("serves a lesson once a rewrite fixes the sections the judge rejected", async () => {
    const { lessons, service } = setup(
      scriptedProvider({
        entailment: CONTRADICTS,
        quickEntailment: SUPPORTS,
        revisionPasses: true,
      }),
    );
    const events = await collect(service);
    expect(events.map((event) => event.type)).toEqual(["quick-answer", "lesson", "visuals"]);
    const lesson = events[1]?.type === "lesson" ? events[1].data : undefined;
    expect(lesson?.reviewStatus).toBe("auto-validated");
    expect(
      lesson?.sections
        .filter((section) => section.module !== "short-answer")
        .every((section) => section.text === REVISED),
    ).toBe(true);
    expect(lessons.at(-1)?.reviewStatus).toBe("auto-validated");
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
      gatherer(),
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
      gatherer(),
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
