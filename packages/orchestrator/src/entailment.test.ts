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
    const check = createEntailmentCheck(scriptedProvider([supports, supports], seen));

    const result = await check.run(makeLesson());

    expect(result).toMatchObject({
      name: "entailment",
      passed: true,
      details: ["3 uncited sections skipped"],
    });
    expect(seen).toHaveLength(2);
    expect(JSON.stringify(seen[0]?.messages)).toContain(CLAIM_A);
    expect(seen[0]?.jsonSchema?.name).toBe("Verdict");
  });

  it("fails the lesson on a contradicted section", async () => {
    const check = createEntailmentCheck(scriptedProvider([supports, contradicts]));

    const result = await check.run(makeLesson());

    expect(result.passed).toBe(false);
    expect(result.details.join("\n")).toContain("apply-4");
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
    expect(result.details.join("\n")).toContain("5 uncited sections skipped");
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
    expect(ENTAILMENT_PROMPT_VERSION).toBe("orchestrator-entailment-p0.4");
    expect(CONTRADICTION_PROMPT_VERSION).toBe("orchestrator-contradiction-p0.1");
  });

  it("tells the judge which object and module it is checking", async () => {
    const seen: CompletionRequest[] = [];
    const supports = JSON.stringify({ verdict: "supports", reason: "ok" });
    await createEntailmentCheck(scriptedProvider([supports, supports], seen), {
      objectLabel: "Electric kettle",
    }).run(makeLesson());
    const user = String(seen[0]?.messages[1]?.content);
    expect(user).toMatch(/^Object: Electric kettle\nModule: [a-z-]+/);
    expect(String(seen[0]?.messages[0]?.content)).toContain(
      "applying a cited general principle to the object",
    );
  });

  it("judges a section's heading together with its text", async () => {
    const seen: CompletionRequest[] = [];
    const base = makeLesson();
    const lesson = {
      ...base,
      sections: base.sections.map((section, index) =>
        index === 2 ? { ...section, heading: "Steam lifts the lid" } : section,
      ),
    };
    await createEntailmentCheck(scriptedProvider([supports, supports], seen)).run(lesson);
    const judged = seen.map((request) => String(request.messages[1]?.content));
    expect(
      judged.some((text) => text.includes(`Steam lifts the lid\n\n${lesson.sections[2]?.text}`)),
    ).toBe(true);
  });

  it("judges a demonstration's steps and apply's challenge feedback with their sections", async () => {
    const seen: CompletionRequest[] = [];
    await createEntailmentCheck(scriptedProvider([supports, supports], seen)).run(makeLesson());
    const judged = (module: string) =>
      seen
        .map((request) => String(request.messages[1]?.content))
        .find((text) => text.includes(`Module: ${module}`)) ?? "";
    expect(judged("demonstrate")).toContain("1. The water heats the strip.");
    expect(judged("demonstrate")).toContain("2. The strip bends and the switch clicks off.");
    expect(judged("apply")).toContain("Challenge: Boil the water in under two minutes.");
    expect(judged("apply")).toContain("That boils it far too fast.");
    expect(judged("apply")).not.toContain("No timer is involved.");
    expect(String(seen[0]?.messages[0]?.content)).toContain("scenarios, not facts");
  });
});
