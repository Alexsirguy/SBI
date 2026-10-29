import { describe, expect, it } from "vitest";
import { Lesson, type Claim } from "@sbi/contracts";
import { type Completion, type CompletionRequest, type LlmProvider } from "@sbi/llm";
import { generateDraft, type DraftInput } from "./draft";

const CLAIM_A = "123e4567-e89b-12d3-a456-426614174000";
const CLAIM_B = "123e4567-e89b-12d3-a456-426614174001";
const SOURCE = "123e4567-e89b-12d3-a456-426614174002";
const SNAPSHOT = "123e4567-e89b-12d3-a456-426614174003";
const UNKNOWN = "123e4567-e89b-12d3-a456-426614174009";

function claim(claimId: string, text: string): Claim {
  return {
    claimId,
    text,
    status: "supported",
    sourceIds: [SOURCE],
    scope: "textbook",
    confidence: "high",
    dependsOn: [],
  };
}

function stubProvider(text: string, seen: CompletionRequest[] = []): LlmProvider {
  return {
    id: "stub",
    model: "stub-1",
    async complete(request: CompletionRequest): Promise<Completion> {
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

const base: DraftInput = {
  intentSignature: "abc123",
  question: "Why does my kettle click off?",
  taxonomyId: "home.kettle",
  locale: "en-GB",
  audience: ["general"],
  readingLevel: "plain",
  safetyClass: "low",
  concepts: [{ conceptId: "thermostat", label: "Thermostat", prerequisites: [] }],
  claims: [
    claim(CLAIM_A, "Bimetallic thermostats snap open when hot."),
    claim(CLAIM_B, "Water boils at 100C at sea level."),
  ],
  evidenceSnapshotId: SNAPSHOT,
  policyVersion: "safety-1",
};

const section = (module: string, claimIds: string[]) => ({
  module,
  text: `${module} text.`,
  claimIds,
});

const fragment = {
  title: "Why kettles click off",
  summary: "A thermostat snaps the kettle off.",
  learningObjectives: ["Explain the click"],
  sections: [
    section("what-youre-seeing", [CLAIM_A]),
    section("short-answer", [CLAIM_A, CLAIM_B]),
    section("first-principles", [CLAIM_B]),
  ],
};

describe("generateDraft", () => {
  it("generates a Lesson-conforming draft grounded in the given claims", async () => {
    const lesson = await generateDraft(base, { provider: stubProvider(JSON.stringify(fragment)) });

    expect(() => Lesson.parse(lesson)).not.toThrow();
    expect(lesson.reviewStatus).toBe("generated");
    expect(lesson.version).toBe(1);
    expect(lesson.claims).toHaveLength(2);
    expect(lesson.sections.map((item) => item.sectionId)).toEqual([
      "what-youre-seeing-1",
      "short-answer-2",
      "first-principles-3",
    ]);
    expect(lesson.reuse).toMatchObject({
      intentSignature: "abc123",
      matchDimensions: ["intent", "depth", "locale", "assumptions", "safety"],
      cacheScope: "private",
      sourceFreshness: "fresh",
      modelVersion: "stub-1",
      promptVersion: "lesson-draft@1",
      policyVersion: "safety-1",
      evidenceSnapshotId: SNAPSHOT,
      reuseCount: 0,
    });
    expect(lesson.reuse.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects fragments citing claims outside the graph", async () => {
    const bad = {
      ...fragment,
      sections: [
        section("what-youre-seeing", [CLAIM_A]),
        section("short-answer", [UNKNOWN]),
        section("first-principles", [CLAIM_B]),
      ],
    };

    await expect(
      generateDraft(base, { provider: stubProvider(JSON.stringify(bad)) }),
    ).rejects.toThrow(/does not conform.*Unknown claim/s);
  });

  it("rejects malformed model output", async () => {
    await expect(generateDraft(base, { provider: stubProvider("not json") })).rejects.toThrow(
      "stub: invalid structured output",
    );
  });

  it("carries depth and age-band variants into the prompt and the draft", async () => {
    const seen: CompletionRequest[] = [];
    const lesson = await generateDraft(
      { ...base, audience: ["child"], readingLevel: "simple" },
      { provider: stubProvider(JSON.stringify(fragment), seen) },
    );

    const userText = JSON.stringify(seen[0]?.messages);
    expect(userText).toContain("child");
    expect(userText).toContain("simple");
    expect(seen[0]?.jsonSchema?.name).toBe("LessonDraft");
    expect(seen[0]?.prompt).toEqual({ id: "lesson-draft", version: "1" });
    expect(lesson.audience).toEqual(["child"]);
    expect(lesson.readingLevel).toBe("simple");
  });

  it("honours a pinned prompt version", async () => {
    const lesson = await generateDraft(
      { ...base, promptVersion: "1" },
      { provider: stubProvider(JSON.stringify(fragment)) },
    );

    expect(lesson.reuse.promptVersion).toBe("lesson-draft@1");
    await expect(
      generateDraft({ ...base, promptVersion: "9" }, { provider: stubProvider("{}") }),
    ).rejects.toThrow('Unknown prompt "lesson-draft" version "9"');
  });
});
