import { fixedQuestions } from "@sbi/contracts";
import type { Completion, LlmProvider } from "@sbi/llm";
import { afterEach, describe, expect, it } from "vitest";
import { createRateLimiter } from "../common/rate-limiter";
import { startTestApp, type TestApp } from "../testing/test-app";
import { QuestionsController } from "./questions.controller";

const WRITTEN = [
  "Why does a kettle click off by itself?",
  "How does the element heat water so fast?",
  "Why does a kettle get limescale?",
  "Why is a kettle loud just before it boils?",
  "Does a fuller kettle take longer to boil?",
];

function provider(answer: () => Promise<string>): LlmProvider {
  return {
    id: "stub",
    model: "stub-1",
    async complete(): Promise<Completion> {
      return {
        text: await answer(),
        model: "stub-1",
        latencyMs: 1,
        usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
      };
    },
  };
}

const limiter = (limit = 5) => createRateLimiter({ limit, windowMs: 60_000 });
const body = { subject: "Electric kettle" };
const FIXED = { questions: fixedQuestions("Electric kettle"), source: "fixed" };

describe("QuestionsController", () => {
  it("suggests the model's questions about the object", async () => {
    const controller = new QuestionsController(
      provider(async () => JSON.stringify({ questions: WRITTEN })),
      limiter(),
    );
    expect(await controller.suggest(body, "203.0.113.7")).toEqual({
      questions: WRITTEN,
      source: "model",
    });
  });

  it("stands in the fixed questions when the model fails or is off", async () => {
    const failing = new QuestionsController(
      provider(async () => {
        throw new Error("model down");
      }),
      limiter(),
    );
    expect(await failing.suggest(body, "203.0.113.7")).toEqual(FIXED);
    expect(await new QuestionsController(null, limiter()).suggest(body, "203.0.113.7")).toEqual(
      FIXED,
    );
  });

  it("stops calling the model for a client past its limit, but still answers", async () => {
    let calls = 0;
    const controller = new QuestionsController(
      provider(async () => {
        calls += 1;
        return JSON.stringify({ questions: WRITTEN });
      }),
      limiter(1),
    );
    await controller.suggest(body, "203.0.113.7");
    expect(await controller.suggest(body, "203.0.113.7")).toEqual(FIXED);
    expect(calls).toBe(1);
  });

  let test: TestApp | undefined;
  afterEach(async () => {
    await test?.app.close();
    test = undefined;
  });

  it("answers 400 with a plain message when no object is named", async () => {
    test = await startTestApp();
    const response = await test.post("/lessons/questions", { subject: "" });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Name the object in a few words." });
  });
});
