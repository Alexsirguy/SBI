import { describe, expect, it } from "vitest";
import { type Completion, type CompletionRequest, type LlmProvider } from "@sbi/llm";
import {
  CONTRADICTION_PROMPT_VERSION,
  createContradictionCheck,
  createEntailmentCheck,
  ENTAILMENT_PROMPT_VERSION,
} from "./entailment";
import { CLAIM_A, makeLesson } from "./lesson-fixture";

function scriptedProvider(texts: string[], seen: CompletionRequest[] = []): LlmProvider {
  const queue = [...texts];
  return {
    id: "stub",
    model: "stub-1",
    async complete(request: CompletionRequest): Promise<Completion> {
      const text = queue.shift();
      if (text === undefined) throw new Error("No scripted verdict left");
      seen.push(request);
      return {
        text,
        model: "stub-1",
        usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
        latencyMs: 0,
        prompt: request.prompt,
      };
    },
  };
}

const supports = JSON.stringify({ verdict: "supports", reason: "Claims state it." });
const contradicts = JSON.stringify({ verdict: "contradicts", reason: "Section flips the cause." });
const agree = JSON.stringify({ contradiction: false, reason: "", claimIds: [] });

describe("createEntailmentCheck", () => {
  it("passes when every cited section is supported", async () => {
    const seen: CompletionRequest[] = [];
    const check = createEntailmentCheck(scriptedProvider([supports, supports, supports], seen));

    const result = await check.run(makeLesson());

    expect(result).toMatchObject({ name: "entailment", passed: true, details: [] });
    expect(seen).toHaveLength(3);
    expect(JSON.stringify(seen[0]?.messages)).toContain(CLAIM_A);
    expect(seen[0]?.jsonSchema?.name).toBe("Verdict");
  });

  it("fails the lesson on a contradicted section", async () => {
    const check = createEntailmentCheck(scriptedProvider([supports, contradicts, supports]));

    const result = await check.run(makeLesson());

    expect(result.passed).toBe(false);
    expect(result.details.join("\n")).toContain("what-youre-seeing-2");
    expect(result.details.join("\n")).toContain("contradicts");
  });

  it("skips uncited sections with a note", async () => {
    const lesson = makeLesson();
    const uncited = {
      ...lesson,
      sections: lesson.sections.map((section) => ({ ...section, claimIds: [] as string[] })),
    };
    const seen: CompletionRequest[] = [];
    const check = createEntailmentCheck(scriptedProvider([], seen));

    const result = await check.run(uncited);

    expect(result.passed).toBe(true);
    expect(result.details.join("\n")).toContain("3 uncited sections skipped");
    expect(seen).toHaveLength(0);
  });

  it("rejects malformed verdicts", async () => {
    const check = createEntailmentCheck(scriptedProvider(["not json"]));

    await expect(check.run(makeLesson())).rejects.toThrow("stub: invalid structured output");
  });
});

describe("createContradictionCheck", () => {
  it("passes agreeing claims and fails clashing ones", async () => {
    const pass = createContradictionCheck(scriptedProvider([agree]));
    expect(await pass.run(makeLesson())).toMatchObject({ name: "contradictions", passed: true });

    const clash = JSON.stringify({
      contradiction: true,
      reason: "Boiling points disagree.",
      claimIds: ["a", "b"],
    });
    const seen: CompletionRequest[] = [];
    const fail = createContradictionCheck(scriptedProvider([clash], seen));

    const result = await fail.run(makeLesson());

    expect(result.passed).toBe(false);
    expect(result.details.join("\n")).toContain("Boiling points disagree.");
    expect(JSON.stringify(seen[0]?.messages)).toContain("Bimetallic thermostats");
  });
});

describe("prompt versions", () => {
  it("sends each judge's prompt version with its request, for the logs", async () => {
    const seen: CompletionRequest[] = [];
    const agree = JSON.stringify({ contradiction: false, reason: "", claimIds: [] });
    await createContradictionCheck(scriptedProvider([agree], seen)).run(makeLesson());
    expect(seen[0]?.prompt).toEqual({
      id: "orchestrator-contradiction",
      version: CONTRADICTION_PROMPT_VERSION,
    });
  });

  it("pins judge prompt versions", () => {
    expect(ENTAILMENT_PROMPT_VERSION).toBe("orchestrator-entailment-p0.2");
    expect(CONTRADICTION_PROMPT_VERSION).toBe("orchestrator-contradiction-p0.1");
  });
});
