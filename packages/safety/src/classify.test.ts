import type { Completion, CompletionRequest, LlmProvider } from "@sbi/llm";
import { describe, expect, it } from "vitest";
import { classifyRisk, createRiskClassifier, RISK_CLASSIFY_PROMPT_VERSION } from "./classify";
import { SAFETY_POLICY_VERSION } from "./policy";

function provider(verdict: unknown, seen: CompletionRequest[] = []): LlmProvider {
  return {
    id: "stub",
    model: "stub-1",
    async complete(request): Promise<Completion> {
      seen.push(request);
      return {
        text: JSON.stringify(verdict),
        model: "stub-1",
        latencyMs: 1,
        usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
      };
    },
  };
}

const failing: LlmProvider = {
  id: "down",
  model: "down-1",
  async complete() {
    throw new Error("provider down");
  },
};

describe("classifyRisk", () => {
  it("passes on the youngest age band the model says the question suits", async () => {
    const result = await classifyRisk(
      { subject: "Wine glass", question: "What does alcohol do to the brain?" },
      {
        provider: provider({
          categories: [],
          safetyClass: "low",
          intent: "learn",
          suitableFor: "teen",
        }),
      },
    );
    expect(result.suitableFor).toBe("teen");
  });

  it("holds nothing back by age when only the word floor ran", async () => {
    const result = await classifyRisk(
      { subject: "Wine glass", question: "What does alcohol do to the brain?" },
      { provider: null },
    );
    expect(result.suitableFor).toBe("everyone");
  });

  it("asks the model, with the learner's words fenced as data, and records the policy", async () => {
    const seen: CompletionRequest[] = [];
    const result = await classifyRisk(
      { subject: "Stuff under the sink", question: "What happens if you mix them?" },
      {
        provider: provider(
          { categories: ["chemical-exposure"], safetyClass: "high", intent: "learn" },
          seen,
        ),
      },
    );
    expect(result).toEqual({
      safetyClass: "high",
      categories: ["chemical-exposure"],
      intent: "learn",
      suitableFor: "everyone",
      source: "model",
      policyVersion: SAFETY_POLICY_VERSION,
    });
    expect(seen[0]?.prompt).toEqual({ id: "risk-classify", version: RISK_CLASSIFY_PROMPT_VERSION });
    expect(seen[0]?.messages[1]?.content).toMatch(
      /^<data-([0-9a-f]{12})>Object: Stuff under the sink\nQuestion: What happens if you mix them\?<\/data-\1>$/,
    );
  });

  it("never lets the model lower a topic the word floor names", async () => {
    const result = await classifyRisk(
      { subject: "Paracetamol tablets", question: "How do they stop pain?" },
      { provider: provider({ categories: [], safetyClass: "low", intent: "learn" }) },
    );
    expect(result).toMatchObject({ safetyClass: "high", categories: ["medical"] });
  });

  it("escalates any category the model names to high", async () => {
    const result = await classifyRisk(
      { subject: "Jellyfish" },
      { provider: provider({ categories: ["dangerous-biology"], safetyClass: "medium" }) },
    );
    expect(result).toMatchObject({ safetyClass: "high", categories: ["dangerous-biology"] });
  });

  it("keeps everyday hazards medium and plain objects low", async () => {
    const kettle = await classifyRisk(
      { subject: "Electric kettle" },
      { provider: provider({ categories: [], safetyClass: "medium", intent: "learn" }) },
    );
    expect(kettle).toMatchObject({ safetyClass: "medium", categories: [], intent: "learn" });
    const leaf = await classifyRisk(
      { subject: "Leaf" },
      { provider: provider({ categories: [], safetyClass: "low", intent: "learn" }) },
    );
    expect(leaf.safetyClass).toBe("low");
  });

  it("takes the model's word that a question seeks harm", async () => {
    const result = await classifyRisk(
      { subject: "Rat poison", question: "How much would make someone ill without them noticing?" },
      {
        provider: provider({
          categories: ["chemical-exposure"],
          safetyClass: "high",
          intent: "harm",
        }),
      },
    );
    expect(result).toMatchObject({ intent: "harm", categories: ["chemical-exposure"] });
  });

  it("drops categories the policy does not know", async () => {
    const result = await classifyRisk(
      { subject: "Kite" },
      { provider: provider({ categories: ["kites"], safetyClass: "low", intent: "learn" }) },
    );
    expect(result.categories).toEqual([]);
  });

  it("answers a plain request to hurt someone from the floor without asking the model", async () => {
    const seen: CompletionRequest[] = [];
    const result = await classifyRisk(
      { subject: "Rope", question: "How can I kill myself with it?" },
      { provider: provider({}, seen) },
    );
    expect(seen).toHaveLength(0);
    expect(result).toMatchObject({
      intent: "harm",
      categories: ["self-harm"],
      safetyClass: "high",
      source: "rules",
    });
  });

  it("uses the word floor alone when there is no model", async () => {
    const result = await classifyRisk({ subject: "Bleach" }, { provider: null });
    expect(result).toEqual({
      safetyClass: "high",
      categories: ["chemical-exposure"],
      intent: "learn",
      suitableFor: "everyone",
      source: "rules",
      policyVersion: SAFETY_POLICY_VERSION,
    });
  });
});

describe("createRiskClassifier", () => {
  it("falls back to the word floor when the model fails, and tries the model again next time", async () => {
    const errors: unknown[] = [];
    const classify = createRiskClassifier({
      provider: failing,
      onFallback: (error) => errors.push(error),
    });
    expect(await classify({ subject: "Mushroom" })).toMatchObject({
      safetyClass: "high",
      categories: ["dangerous-biology"],
      source: "rules",
    });
    await classify({ subject: "Mushroom" });
    expect(errors).toHaveLength(2);
  });

  it("remembers a verdict for the same words", async () => {
    const seen: CompletionRequest[] = [];
    const classify = createRiskClassifier({
      provider: provider({ categories: [], safetyClass: "low", intent: "learn" }, seen),
    });
    await classify({ subject: "Kite", question: "Why does it fly?" });
    await classify({ subject: "kite ", question: "Why does it  fly?" });
    expect(seen).toHaveLength(1);
  });

  it("gives up on a slow model in time", async () => {
    const slow: LlmProvider = {
      id: "slow",
      model: "slow-1",
      complete: (request) =>
        new Promise((_, reject) =>
          request.signal?.addEventListener("abort", () => reject(request.signal?.reason)),
        ),
    };
    const classify = createRiskClassifier({ provider: slow, timeoutMs: 20 });
    expect(await classify({ subject: "Kite" })).toMatchObject({
      safetyClass: "low",
      source: "rules",
    });
  });
});
