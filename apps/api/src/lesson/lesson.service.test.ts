import { HttpStatus } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  isMerrillLesson,
  Lesson,
  type Claim,
  type Lesson as LessonType,
  type LessonRequest,
} from "@sbi/contracts";
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
  LESSON_DRAFT_PROMPT_VERSION,
  type LessonRepository,
  type TaxonomyLessonLookup,
} from "@sbi/orchestrator";
import {
  CATEGORY_NOTICES,
  policyResponse,
  SAFETY_POLICY_VERSION,
  type RiskAssessment,
  type RiskInput,
} from "@sbi/safety";
import { createTaxonomy, type Taxonomy } from "@sbi/taxonomy";
import { UserFacingException } from "../common/user-facing.exception";
import {
  effectiveSafetyClass,
  LESSON_POLICY_VERSION,
  safetyNoticeFor,
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

const CLEARED = { check: async () => ({ cleared: true }) };
function subjectRequest(subject: string): LessonRequest {
  return { ...REQUEST, taxonomyId: undefined, subject };
}

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

const NO_GOAL = { readoutId: "", op: "atLeast", value: 0, tolerance: 0 };

function challenge(prompt: string, value: number) {
  return {
    module: "apply",
    prompt,
    options: ["More power", "Less power"],
    answerIndex: 0,
    feedback: ["Right: more power heats it faster.", "Less power heats it more slowly."],
    setup: [{ controlId: "power", value: 1000 }],
    goal: { readoutId: "boilTime", op: "atMost", value, tolerance: 0 },
    claimIds: [] as string[],
  };
}

// A Merrill draft (ADR 0017), as the model returns it for the v7 prompt.
const FRAGMENT = {
  title: "Why kettles click off",
  summary: "A thermostat snaps the kettle off.",
  learningObjectives: ["Explain the click"],
  assumptions: [],
  misconceptionNotes: [],
  sections: [
    {
      module: "problem",
      heading: "Your kettle stops itself",
      text: "Your kettle clicks off on its own. What tells it to stop?",
      claimIds: [] as string[],
      steps: [],
    },
    {
      module: "activate",
      text: "Think of a spoon in hot tea.",
      claimIds: [] as string[],
      steps: [],
    },
    {
      module: "demonstrate",
      text: "Heat snaps a small switch.",
      claimIds: [CLAIM_A],
      steps: [
        { text: "The water heats a metal strip.", settings: [{ controlId: "power", value: 2000 }] },
        { text: "The strip bends, so the switch opens.", settings: [] },
      ],
    },
    {
      module: "apply",
      text: "Now try a travel kettle.",
      claimIds: [CLAIM_A],
      steps: [],
    },
    {
      module: "integrate",
      text: "Listen for the click this week. What else stops when it is warm?",
      claimIds: [] as string[],
      steps: [],
    },
  ],
  tasks: [
    {
      module: "activate",
      prompt: "What makes the kettle switch off?",
      options: ["A timer", "The heat"],
      answerIndex: 1,
      feedback: ["No timer is involved.", "Yes: heat bends a strip."],
      setup: [],
      goal: NO_GOAL,
      claimIds: [] as string[],
    },
    challenge("Boil it in under two minutes.", 120),
    challenge("Boil it in under three minutes.", 180),
  ],
  experiment: {
    controls: [{ id: "power", label: "Power", unit: "W", min: 500, max: 3000, value: 2000 }],
    readouts: [{ id: "boilTime", label: "Time to boil", unit: "s" }],
  },
};

// A factual section with no citation: an integrity failure that is held, never disclosed.
const UNCITED_FRAGMENT = {
  ...FRAGMENT,
  sections: FRAGMENT.sections.map((section) =>
    section.module === "apply" ? { ...section, claimIds: [] as string[] } : section,
  ),
};

const SUPPORTS = JSON.stringify({ verdict: "supports", reason: "Claims state it." });
const CONTRADICTS = JSON.stringify({ verdict: "contradicts", reason: "Section flips the cause." });
const AGREE = JSON.stringify({ contradiction: false, reason: "", claimIds: [] });

// Routes by prompt shape so parallel judge calls cannot steal each other's verdicts.
interface Script {
  entailment?: string;
  /** When set, revised sections are judged as supported, so a repair succeeds. */
  revisionPasses?: boolean;
  /** When set, only this module's section gets the entailment verdict; the rest are supported. */
  rejects?: string;
  fragment?: typeof FRAGMENT;
}

const REVISED = "Revised to state only what the claims support.";

// Routes by prompt id and shape so parallel calls cannot steal each other's answers.
function scriptedProvider(options: Script = {}): LlmProvider {
  return {
    id: "stub",
    model: "stub-1",
    async complete(request: CompletionRequest): Promise<Completion> {
      const text = JSON.stringify(request.messages);
      let payload: string;
      if (request.prompt?.id === "lesson-revise") {
        payload = JSON.stringify({ text: REVISED });
      } else if (request.prompt?.id === "lesson-draft") {
        payload = JSON.stringify(options.fragment ?? FRAGMENT);
      } else if (text.includes("<section-") && options.revisionPasses && text.includes(REVISED)) {
        payload = SUPPORTS;
      } else if (text.includes("<section-")) {
        const rejected = !options.rejects || text.includes(`Module: ${options.rejects}`);
        payload = rejected ? (options.entailment ?? SUPPORTS) : SUPPORTS;
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

type ResearchQuestion = EvidencePack["questions"][number];

function researched(key: string, question: string, claimIds: string[] = []): ResearchQuestion {
  return {
    key,
    discipline: "physics",
    question,
    claimIds,
    sources: claimIds.length,
    failures: [],
    completed: true,
  };
}

// Replays the given gather events and returns the given claims, standing in for gatherEvidence.
function gatherer(
  claims: Claim[] = [],
  events: GatherEvent[] = [],
  pack: Partial<EvidencePack> = {},
): EvidenceGatherer {
  return async (_input, options) => {
    for (const event of events) options.onEvent?.(event);
    return { claims, reused: false, pack: pack as EvidencePack };
  };
}

const SAFE: RiskAssessment = {
  safetyClass: "low",
  categories: [],
  intent: "learn",
  source: "rules",
  policyVersion: SAFETY_POLICY_VERSION,
};

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
    service: new LessonService(
      provider,
      taxonomy(),
      repo,
      EVIDENCE.evidence,
      audit,
      gather,
      CLEARED,
    ),
  };
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
  it("streams a Merrill lesson after its answer event, then sources and visuals", async () => {
    const { lessons, service } = setup(scriptedProvider());

    const events = await collect(service);

    expect(events.map((event) => event.type)).toEqual([
      "quick-answer",
      "lesson",
      "sources",
      "visuals",
    ]);
    const [answer, full, sources, visuals] = events;
    expect(answer?.type).toBe("quick-answer");
    if (answer?.type !== "quick-answer") throw new Error("First event must answer first");
    if (full?.type !== "lesson") throw new Error("Second event must be the lesson");
    // No short-answer section any more, so the summary stands in for it.
    expect(answer.data).toMatchObject({
      kind: "fresh",
      lessonId: full.data.lessonId,
      shortAnswer: FRAGMENT.summary,
      claimIds: [],
      reviewStatus: "auto-validated",
    });
    expect(answer.data.note).toBeUndefined();
    expect(() => Lesson.parse(full.data)).not.toThrow();
    expect(isMerrillLesson(full.data)).toBe(true);
    expect(full.data.tasks.map((task) => task.module)).toEqual(["activate", "apply", "apply"]);
    expect(full.data.experiment?.readouts.map((readout) => readout.id)).toEqual(["boilTime"]);
    expect(full.data.sections.find((section) => section.module === "demonstrate")?.steps).toEqual(
      FRAGMENT.sections[2]?.steps,
    );
    expect(full.data.reuse.policyVersion).toBe(LESSON_POLICY_VERSION);
    expect(visuals).toMatchObject({ type: "visuals", data: { visuals: [] } });
    if (sources?.type !== "sources") throw new Error("Sources must follow the lesson");
    expect(sources.data.sources.map((source) => source.credit).sort()).toEqual([
      expect.stringContaining("NIST"),
      expect.stringContaining("USGS"),
    ]);
    expect(sources.data.sources[0]?.excerpts[0]).toMatchObject({
      mode: "quote",
      text: "Bimetallic thermostats snap open when hot.",
    });
    expect(lessons).toHaveLength(1);
  });

  it("never answers before the lesson, so the learner can guess first", async () => {
    const asked: string[] = [];
    const base = scriptedProvider();
    const provider: LlmProvider = {
      ...base,
      complete: (request) => {
        asked.push(request.prompt?.id ?? "");
        return base.complete(request);
      },
    };
    const { service } = setup(
      provider,
      [],
      gatherer([EVIDENCE.claim], [{ type: "verified", key: "q1", claims: [EVIDENCE.claim] }]),
    );
    const events = await collectAll(service);
    expect(asked).not.toContain("quick-answer");
    const firstAnswer = events.findIndex((event) => event.type === "quick-answer");
    const lesson = events.findIndex((event) => event.type === "lesson");
    expect(events.filter((event) => event.type === "quick-answer")).toHaveLength(1);
    expect(firstAnswer).toBe(lesson - 1);
    expect(events.slice(0, firstAnswer).every((event) => event.type === "progress")).toBe(true);
  });

  it("ends the stream with a clear message when an integrity failure holds the lesson", async () => {
    const { service } = setup(scriptedProvider({ fragment: UNCITED_FRAGMENT }));
    const failure = await userFacing(() => collect(service));
    expect(failure.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(failure.message).toContain("reviewer needs to check");
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
      CLEARED,
    );
    const events = await collect(target);
    expect(events.map((event) => event.type)).toEqual([
      "quick-answer",
      "lesson",
      "sources",
      "visuals",
    ]);
    const lesson = events[1]?.type === "lesson" ? events[1].data : undefined;
    expect(lesson?.claims.map((claim) => claim.claimId)).toEqual([EVIDENCE.claim.claimId]);
    expect(lesson?.concepts.map((concept) => concept.label)).toEqual(["Kettle"]);
    expect(lessons).toHaveLength(1);
  });

  it("teaches a subject the catalogue does not have, under its own stable id", async () => {
    const { lessons, repo } = memoryLessons();
    const target = new LessonService(
      scriptedProvider(),
      taxonomy(),
      repo,
      EVIDENCE.evidence,
      createMemoryReviewAuditLog(),
      gatherer([EVIDENCE.claim]),
      CLEARED,
    );
    const events = await collect(target, subjectRequest("camping kettle"));
    const lesson = events.find((event) => event.type === "lesson");
    expect(lesson?.type === "lesson" && lesson.data.taxonomyId).toBe("subject.camping-kettle");
    expect(lessons.at(-1)?.concepts.map((concept) => concept.label)).toEqual(["Camping kettle"]);
  });

  it("serves a free subject on a high-risk topic with that topic's safety notice", async () => {
    const target = new LessonService(
      scriptedProvider(),
      taxonomy(),
      memoryLessons().repo,
      EVIDENCE.evidence,
      createMemoryReviewAuditLog(),
      gatherer([EVIDENCE.claim]),
      CLEARED,
    );
    const events = await collect(target, subjectRequest("oven cleaner spray"));
    const lesson = events.find((event) => event.type === "lesson");
    if (lesson?.type !== "lesson") throw new Error("no lesson");
    expect(lesson.data.safetyClass).toBe("high");
    expect(lesson.data.disclaimers?.[0]?.message).toContain("Household chemicals");
  });

  it("serves a topic the classifier flags with its category's notice first", async () => {
    const asked: RiskInput[] = [];
    const target = new LessonService(
      scriptedProvider(),
      taxonomy(),
      memoryLessons().repo,
      EVIDENCE.evidence,
      createMemoryReviewAuditLog(),
      gatherer([EVIDENCE.claim]),
      CLEARED,
      undefined,
      async (input) => {
        asked.push(input);
        return { ...SAFE, safetyClass: "high", categories: ["dangerous-biology"], source: "model" };
      },
    );
    const events = await collect(target, subjectRequest("jellyfish"));
    const lesson = events.find((event) => event.type === "lesson");
    if (lesson?.type !== "lesson") throw new Error("no lesson");
    expect(asked).toEqual([{ subject: "Jellyfish", question: REQUEST.question }]);
    expect(lesson.data.safetyClass).toBe("high");
    expect(lesson.data.disclaimers?.[0]).toMatchObject({
      kind: "safety",
      message: CATEGORY_NOTICES["dangerous-biology"],
    });
    expect(lesson.data.reuse.policyVersion).toBe(SAFETY_POLICY_VERSION);
  });

  it("answers a question that seeks harm with help instead of a lesson", async () => {
    const { lessons, service: target } = setup(scriptedProvider());
    const events = await collectAll(target, {
      ...subjectRequest("rope"),
      question: "How can I hurt myself with this?",
    });
    expect(events).toEqual([{ type: "policy", data: policyResponse("self-harm") }]);
    expect(lessons).toHaveLength(0);
  });

  it("streams research progress while evidence is gathered", async () => {
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
    expect(types.slice(0, 3)).toEqual([
      "progress:researching",
      "progress:verified",
      "progress:drafting",
    ]);
    expect(types).toContain("progress:checking");
    expect(types.slice(-4)).toEqual(["quick-answer", "lesson", "sources", "visuals"]);
    const researching = events[0]?.type === "progress" ? events[0].data.message : "";
    expect(researching).toContain("How does a bimetallic strip bend?");
  });

  it("teaches from model knowledge with one disclaimer when no source or fact exists", async () => {
    const bare = createTaxonomy([
      { id: "test.home", kind: "category", label: "Home" },
      { id: "test.kettle", kind: "object", label: "Kettle", parentId: "test.home" },
    ]);
    const base = scriptedProvider();
    const asked: string[] = [];
    // Answers the gaps from "memory", then drafts citing whichever claim ids the prompt offers.
    const provider: LlmProvider = {
      ...base,
      complete: async (request) => {
        const user = String(request.messages[1]?.content);
        if (request.prompt?.id === "model-knowledge") {
          asked.push(user);
          return {
            ...(await base.complete(request)),
            text: JSON.stringify({
              claims: [
                { gap: 1, text: "A kettle switches off when a heat-sensitive switch opens." },
              ],
            }),
          };
        }
        if (request.prompt?.id === "lesson-draft") {
          const id = /- ([0-9a-f-]{36}) \[general-knowledge\]/.exec(user)?.[1] ?? "";
          return {
            ...(await base.complete(request)),
            text: JSON.stringify({
              ...FRAGMENT,
              sections: FRAGMENT.sections.map((section) =>
                section.claimIds.length > 0 ? { ...section, claimIds: [id] } : section,
              ),
            }),
          };
        }
        return base.complete(request);
      },
    };
    const target = new LessonService(
      provider,
      bare,
      memoryLessons().repo,
      EVIDENCE.evidence,
      createMemoryReviewAuditLog(),
      gatherer([]),
      CLEARED,
    );
    const events = await collect(target);
    expect(events.map((event) => event.type)).toEqual([
      "quick-answer",
      "lesson",
      "sources",
      "visuals",
    ]);
    const lesson = events[1]?.type === "lesson" ? events[1].data : undefined;
    expect(lesson?.claims.map((claim) => claim.origin)).toEqual(["model"]);
    expect(lesson?.reviewStatus).toBe("needs-review");
    expect(lesson?.disclaimers?.map((item) => item.kind)).toEqual(["model-knowledge"]);
    const answer = events[0]?.type === "quick-answer" ? events[0].data : undefined;
    expect(answer?.disclaimers?.map((item) => item.kind)).toEqual(["model-knowledge"]);
    expect(asked[0]).toContain(REQUEST.question);
    expect(asked[0]).not.toContain("invented");
  });

  it("asks model knowledge only about unanswered research questions, never history", async () => {
    const asked: string[] = [];
    const base = scriptedProvider();
    const provider: LlmProvider = {
      ...base,
      complete: async (request) => {
        if (request.prompt?.id === "model-knowledge")
          asked.push(String(request.messages[1]?.content));
        return base.complete(request);
      },
    };
    const pack = {
      questions: [
        researched("q1", "How does a bimetallic strip bend?", [CLAIM_A]),
        researched("q2", "Why does steam carry heat?"),
      ],
    };
    const { service } = setup(provider, [], gatherer([EVIDENCE.claim], [], pack));
    await collect(service);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain("Why does steam carry heat?");
    expect(asked[0]).not.toContain("How does a bimetallic strip bend?");
    expect(asked[0]).not.toMatch(/invented|discovered|history/i);
  });

  it("shares the model-claim cap across gaps, so later gaps are not crowded out", async () => {
    const bare = createTaxonomy([
      { id: "test.home", kind: "category", label: "Home" },
      { id: "test.kettle", kind: "object", label: "Kettle", parentId: "test.home" },
    ]);
    const base = scriptedProvider();
    let draftPrompt = "";
    const provider: LlmProvider = {
      ...base,
      complete: async (request) => {
        if (request.prompt?.id === "model-knowledge") {
          const many = Array.from({ length: 13 }, (_, index) => ({
            gap: 1,
            text: `Kettle fact number ${index + 1} about heating water.`,
          }));
          return {
            ...(await base.complete(request)),
            text: JSON.stringify({
              claims: [...many, { gap: 2, text: "Electric kettles appeared in the 1890s." }],
            }),
          };
        }
        if (request.prompt?.id === "lesson-draft")
          draftPrompt = String(request.messages[1]?.content);
        return base.complete(request);
      },
    };
    const gaps = {
      questions: [
        researched("q1", "What heats the water?"),
        researched("q2", "When did kettles appear?"),
      ],
    };
    const target = new LessonService(
      provider,
      bare,
      memoryLessons().repo,
      EVIDENCE.evidence,
      createMemoryReviewAuditLog(),
      gatherer([], [], gaps),
      CLEARED,
    );
    // The scripted draft cites a claim this lesson lacks; only the prompt it was given matters.
    await collectAll(target).catch(() => undefined);
    expect(draftPrompt).toContain("Electric kettles appeared in the 1890s.");
    expect(draftPrompt.match(/\[general-knowledge\]/g)).toHaveLength(12);
  });

  it("still answers 404 when even model knowledge has nothing to offer", async () => {
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
      CLEARED,
    );
    const failure = await userFacing(() => collect(target));
    expect(failure.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("falls back to sourced taxonomy facts when gathering fails at the provider", async () => {
    const { service } = setup(scriptedProvider(), [], async () => {
      throw new LlmError("stub: timed out after 10ms");
    });
    const events = await collect(service);
    expect(events.map((event) => event.type)).toEqual([
      "quick-answer",
      "lesson",
      "sources",
      "visuals",
    ]);
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

  it("stores the review trail for validated, disclosed and held lessons", async () => {
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

    const disclosed = setup(scriptedProvider({ entailment: CONTRADICTS }));
    await collect(disclosed.service);
    const [move] = await disclosed.audit.history(disclosed.lessons[0]?.lessonId ?? "");
    expect(move).toMatchObject({ from: "generated", to: "needs-review", by: "system" });
    expect(move?.reason).toContain("entailment");

    const held = setup(scriptedProvider({ fragment: UNCITED_FRAGMENT }));
    await userFacing(() => collect(held.service));
    const [hold] = await held.audit.history(held.lessons[0]?.lessonId ?? "");
    expect(hold?.reason).toContain("citations");
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

  it("never serves a cached lesson drafted before the Merrill prompt", async () => {
    const first = setup(scriptedProvider());
    await collect(first.service);
    share(first.lessons);
    for (const lesson of first.lessons) {
      lesson.reuse = { ...lesson.reuse, promptVersion: "lesson-draft@6" };
    }
    const { service: next, lessons } = setup(scriptedProvider(), first.lessons);

    const events = await collect(next);

    if (events[0]?.type !== "quick-answer") throw new Error("First event must answer first");
    expect(events[0].data.kind).toBe("fresh");
    expect(lessons).toHaveLength(2);
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
    expect(events).toHaveLength(4);
  });

  it("asks for a retry when timeouts leave no fallback", async () => {
    const provider = throwingProvider(new LlmError("stub: timed out after 20ms"));
    const { service: target } = setup(provider);

    const failure = await userFacing(() => collect(target));

    expect(failure.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(failure.message).toContain("timed out");
  });

  it("serves a draft the judges doubt with disclaimers, and keeps it awaiting review", async () => {
    const { lessons, service } = setup(scriptedProvider({ entailment: CONTRADICTS }));

    const events = await collect(service);

    const lesson = events.find((event) => event.type === "lesson");
    if (lesson?.type !== "lesson") throw new Error("expected the lesson to be served");
    expect(lesson.data.reviewStatus).toBe("needs-review");
    const kinds = lesson.data.disclaimers?.map((item) => item.kind);
    expect(kinds).toEqual(["awaiting-review", "unverified-sections"]);
    expect(lesson.data.disclaimers?.[1]?.sectionIds.length).toBeGreaterThan(0);
    expect(lessons.at(-1)?.reviewStatus).toBe("needs-review");
  });

  it("serves a lesson once a rewrite fixes the sections the judge rejected", async () => {
    const { lessons, service } = setup(
      scriptedProvider({ entailment: CONTRADICTS, revisionPasses: true, rejects: "demonstrate" }),
    );
    const events = await collect(service);
    expect(events.map((event) => event.type)).toEqual([
      "quick-answer",
      "lesson",
      "sources",
      "visuals",
    ]);
    const lesson = events[1]?.type === "lesson" ? events[1].data : undefined;
    expect(lesson?.reviewStatus).toBe("auto-validated");
    const cited = lesson?.sections.filter((section) => section.claimIds.length > 0) ?? [];
    expect(cited.map((section) => section.module)).toEqual(["demonstrate", "apply"]);
    expect(cited[0]?.text).toBe(REVISED);
    // Apply's text is only its scene, so a rewrite never touches it.
    expect(cited[1]?.text).not.toBe(REVISED);
    expect(cited[0]?.steps).toEqual(FRAGMENT.sections[2]?.steps);
    expect(lessons.at(-1)?.reviewStatus).toBe("auto-validated");
  });

  it("after a rewrite judges only the rewritten section and keeps the contradiction verdict", async () => {
    const base = scriptedProvider({
      entailment: CONTRADICTS,
      revisionPasses: true,
      rejects: "demonstrate",
    });
    const calls: string[] = [];
    const provider: LlmProvider = {
      ...base,
      complete: async (request) => {
        calls.push(request.prompt?.id ?? "");
        return base.complete(request);
      },
    };
    const { service } = setup(provider);
    await collect(service);
    const count = (id: string) => calls.filter((call) => call === id).length;
    expect(count("lesson-revise")).toBe(1);
    // Demonstrate and apply on the first pass, then only the rewritten demonstrate.
    expect(count("orchestrator-entailment")).toBe(3);
    expect(count("orchestrator-contradiction")).toBe(1);
  });

  it("serves the unrepaired draft with its doubts disclosed when the rewrite itself fails", async () => {
    const base = scriptedProvider({ entailment: CONTRADICTS });
    const provider: LlmProvider = {
      ...base,
      complete: async (request) => {
        if (request.prompt?.id === "lesson-revise") throw new LlmError("stub: empty completion");
        return base.complete(request);
      },
    };
    const { service } = setup(provider);
    const events = await collect(service);
    expect(events.map((event) => event.type)).toEqual([
      "quick-answer",
      "lesson",
      "sources",
      "visuals",
    ]);
    const lesson = events[1]?.type === "lesson" ? events[1].data : undefined;
    expect(lesson?.reviewStatus).toBe("needs-review");
    expect(lesson?.disclaimers?.map((item) => item.kind)).toContain("unverified-sections");
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

  it("serves a high-risk topic with its safety notice first, even when the client says low", async () => {
    const { lessons, service: target } = setup(scriptedProvider());

    const events = await collect(target, {
      ...REQUEST,
      taxonomyId: "object.cleaning-products",
      safetyClass: "low",
    });

    expect(events.map((event) => event.type)).toEqual([
      "quick-answer",
      "lesson",
      "sources",
      "visuals",
    ]);
    const [answer, lesson] = events;
    if (answer?.type !== "quick-answer" || lesson?.type !== "lesson") throw new Error("order");
    expect(lesson.data).toMatchObject({ safetyClass: "high", reviewStatus: "needs-review" });
    const [notice] = lesson.data.disclaimers ?? [];
    expect(notice?.kind).toBe("safety");
    expect(notice?.message).toContain("Never mix cleaning products");
    expect(answer.data.disclaimers?.[0]).toEqual(notice);
    expect(lessons.at(-1)?.disclaimers?.[0]?.kind).toBe("safety");
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
      CLEARED,
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
      CLEARED,
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

describe("safetyNoticeFor", () => {
  it("gives each high-risk topic its own notice and nothing to ordinary topics", () => {
    expect(safetyNoticeFor({ id: "object.mushroom" })).toContain(
      "Never eat or taste a wild mushroom",
    );
    expect(safetyNoticeFor({ id: "object.electrical-socket" })).toContain("switch off the power");
    expect(
      safetyNoticeFor({ id: "object.other-chemical", parentId: "category.household-chemicals" }),
    ).toContain("Household chemicals");
    expect(
      safetyNoticeFor({ id: "object.bicycle", parentId: "category.mechanisms" }),
    ).toBeUndefined();
  });
});

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

  it("takes the classifier's verdict when it is higher than the request", () => {
    const bicycle = { id: "object.bicycle" };
    expect(effectiveSafetyClass("low", bicycle, { safetyClass: "medium" })).toBe("medium");
    expect(effectiveSafetyClass("high", bicycle, { safetyClass: "low" })).toBe("high");
  });
});

function firstLesson(): LessonType {
  const sections = FRAGMENT.sections.map(({ steps, ...section }, index) => ({
    ...section,
    sectionId: `${section.module}-${index + 1}`,
    ...(steps.length > 0 ? { steps } : {}),
  }));
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
    sections,
    tasks: FRAGMENT.tasks.map(({ goal, ...task }, index) => ({
      ...task,
      taskId: `${task.module}-${index + 1}`,
      ...(task.module === "apply" ? { goal: { ...goal, tolerance: undefined } } : {}),
    })),
    experiment: FRAGMENT.experiment,
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
      promptVersion: LESSON_DRAFT_PROMPT_VERSION,
      policyVersion: LESSON_POLICY_VERSION,
      reuseCount: 0,
      contentHash: "b".repeat(64),
    },
  });
}
