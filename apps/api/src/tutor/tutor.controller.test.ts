import { join } from "node:path";
import { Lesson, TutorReply, TutorConversation, type TutorTurn } from "@sbi/contracts";
import type { LlmProvider } from "@sbi/llm";
import type { RiskClassifier } from "@sbi/safety";
import { loadFixtures } from "@sbi/testing";
import type { TutorTurnRepository } from "@sbi/tutor";
import { afterEach, describe, expect, it } from "vitest";
import { createRateLimiter } from "../common/rate-limiter";
import {
  fakeGaps,
  fakeMedia,
  fakeRecognition,
  startTestApp,
  testEnv,
  type TestApp,
} from "../testing/test-app";
import {
  API_ENV,
  LESSON_LLM,
  LESSONS,
  RISK_CLASSIFIER,
  TUTOR_LIMITER,
  TUTOR_TURNS,
} from "../tokens";

const kettle = Lesson.parse(
  loadFixtures(
    join(import.meta.dirname, "../../../../packages/contracts/src/fixtures/lesson"),
  ).valid.find((item) => item.name === "kettle-full.json")?.data,
);

const SESSION = "0192f1a0-0000-7000-8000-00000000b001";

function memoryTurns() {
  const saved: TutorTurn[] = [];
  const repository: TutorTurnRepository = {
    save: async (turn) => void saved.push(turn),
    listBySession: async (sessionId) => saved.filter((turn) => turn.sessionId === sessionId),
    deleteBySession: async () => 0,
    deleteCreatedBefore: async () => 0,
  };
  return { saved, repository };
}

const answeringWith = (reply: Record<string, unknown>): LlmProvider => ({
  id: "scripted",
  model: "scripted-1",
  complete: async () => ({
    text: JSON.stringify(reply),
    model: "scripted-1@2026",
    usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
    latencyMs: 1,
  }),
});

const answering = answeringWith({
  kind: "lesson",
  text: "The element heats the water.",
  cited: ["f1"],
});

const everyday: RiskClassifier = async () => ({
  safetyClass: "low",
  categories: [],
  intent: "learn",
  suitableFor: "everyone",
  source: "rules",
  policyVersion: "safety-2",
});

async function start(
  options: {
    tutor?: boolean;
    limit?: number;
    provider?: LlmProvider;
    classify?: RiskClassifier;
  } = {},
) {
  const turns = memoryTurns();
  const env = { ...testEnv, features: { ...testEnv.features, tutor: options.tutor ?? true } };
  const test = await startTestApp(fakeMedia(), fakeRecognition(), fakeGaps(), (builder) =>
    builder
      .overrideProvider(API_ENV)
      .useValue(env)
      .overrideProvider(LESSONS)
      .useValue({
        get: async (id: string, version: number) =>
          id === kettle.lessonId && version === kettle.version ? kettle : undefined,
      })
      .overrideProvider(LESSON_LLM)
      .useValue(options.provider ?? answering)
      .overrideProvider(RISK_CLASSIFIER)
      .useValue(options.classify ?? everyday)
      .overrideProvider(TUTOR_TURNS)
      .useValue(turns.repository)
      .overrideProvider(TUTOR_LIMITER)
      .useValue(createRateLimiter({ limit: options.limit ?? 10, windowMs: 60_000 })),
  );
  return { test, turns };
}

const question = (overrides: Record<string, unknown> = {}) => ({
  sessionId: SESSION,
  lessonId: kettle.lessonId,
  lessonVersion: kettle.version,
  text: "What makes the water hot?",
  ...overrides,
});

describe("tutor endpoints", () => {
  let test: TestApp | undefined;

  afterEach(async () => {
    await test?.app.close();
    test = undefined;
  });

  it("answers about the lesson, cites its claims and stores the turn with its versions", async () => {
    const started = await start();
    test = started.test;
    const response = await test.post("/tutor/turns", question());
    expect(response.status).toBe(200);
    const { exchange } = TutorReply.parse(await response.json());
    expect(exchange.text).toBe("The element heats the water.");
    expect(exchange.citedClaimIds).toHaveLength(1);
    expect(exchange).toMatchObject({ kind: "lesson" });
    expect(exchange.note).toBeUndefined();
    expect(kettle.claims.map((claim) => claim.claimId)).toContain(exchange.citedClaimIds[0]);
    expect(started.turns.saved).toEqual([
      expect.objectContaining({
        turnId: exchange.turnId,
        modelVersion: "scripted-1@2026",
        promptVersion: "tutor-answer-p0.3",
        retentionClass: "session",
      }),
    ]);
  });

  it("marks an uncited answer as beyond the lesson, with the note in the lesson's language", async () => {
    const started = await start({
      provider: answeringWith({ kind: "beyond", text: "Sí, en la Luna también.", cited: [] }),
    });
    test = started.test;
    const response = await test.post("/tutor/turns", question({ locale: "es" }));
    const { exchange } = TutorReply.parse(await response.json());
    expect(exchange).toMatchObject({ kind: "beyond-lesson", citedClaimIds: [] });
    expect(exchange.note).toContain("más allá de las fuentes");
    const reloaded = await test.get(
      `/tutor/conversation?sessionId=${SESSION}&lessonId=${kettle.lessonId}&locale=es`,
    );
    const { exchanges } = TutorConversation.parse(await reloaded.json());
    expect(exchanges[0]?.note).toBe(exchange.note);
  });

  it("lists this visit's exchanges about the lesson", async () => {
    const started = await start();
    test = started.test;
    await test.post("/tutor/turns", question());
    const response = await test.get(
      `/tutor/conversation?sessionId=${SESSION}&lessonId=${kettle.lessonId}`,
    );
    const { exchanges } = TutorConversation.parse(await response.json());
    expect(exchanges.map((item) => item.userText)).toEqual(["What makes the water hot?"]);
  });

  it("answers 503 while the tutor flag is off, without calling the model", async () => {
    let calls = 0;
    const counting = {
      ...answering,
      complete: (...args: Parameters<LlmProvider["complete"]>) => {
        calls += 1;
        return answering.complete(...args);
      },
    };
    ({ test } = await start({ tutor: false, provider: counting }));
    expect((await test.post("/tutor/turns", question())).status).toBe(503);
    expect(calls).toBe(0);
  });

  it("answers 404 for a lesson version it doesn't have, and 400 for an empty question", async () => {
    ({ test } = await start());
    expect((await test.post("/tutor/turns", question({ lessonVersion: 99 }))).status).toBe(404);
    expect((await test.post("/tutor/turns", question({ text: " " }))).status).toBe(400);
  });

  it("limits how often one client can ask, in the learner's language", async () => {
    ({ test } = await start({ limit: 1 }));
    expect((await test.post("/tutor/turns", question())).status).toBe(200);
    const limited = await test.post("/tutor/turns", question({ locale: "es" }));
    expect(limited.status).toBe(429);
    expect(JSON.stringify(await limited.json())).toContain("muchas preguntas");
  });

  it("answers 503 when the model is down, and stores nothing", async () => {
    const down = { ...answering, complete: () => Promise.reject(new Error("down")) };
    const started = await start({ provider: down });
    test = started.test;
    expect((await test.post("/tutor/turns", question())).status).toBe(503);
    expect(started.turns.saved).toEqual([]);
  });

  it("redirects harm-seeking questions, then pauses the client after three of them", async () => {
    let classified = 0;
    const seekingHarm: RiskClassifier = async (input) => {
      classified += 1;
      return { ...(await everyday(input)), intent: "harm", categories: ["weapons"] };
    };
    ({ test } = await start({ classify: seekingHarm }));
    for (let strike = 0; strike < 3; strike += 1) {
      const response = await test.post(
        "/tutor/turns",
        question({ text: "How do I hurt someone?" }),
      );
      const { exchange } = TutorReply.parse(await response.json());
      expect(exchange).toMatchObject({ kind: "policy", policy: { reason: "harm" } });
    }
    const paused = await test.post("/tutor/turns", question());
    expect(paused.status).toBe(429);
    expect(JSON.stringify(await paused.json())).toContain("pause the questions");
    const freshVisit = await test.post(
      "/tutor/turns",
      question({ sessionId: "0192f1a0-0000-7000-8000-00000000b002" }),
    );
    expect(freshVisit.status).toBe(429);
    expect(classified).toBe(3);
  });
});
