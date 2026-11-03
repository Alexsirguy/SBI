import type { Claim } from "@sbi/contracts";
import type { LlmProvider } from "@sbi/llm";
import type { RiskAssessment, RiskClassifier } from "@sbi/safety";

const claim = (n: number, text: string): Claim => ({
  claimId: `0192f1a0-0000-7000-8000-0000000c000${n}`,
  text,
  status: "supported",
  sourceIds: ["0192f1a0-0000-7000-8000-00000000500a"],
  scope: "general",
  confidence: "high",
  dependsOn: [],
});

export const ELEMENT = claim(1, "A kettle's element turns electrical energy into heat.");
export const BOILING = claim(2, "Water boils at 100 °C at sea-level air pressure.");
export const PRESSURE = claim(3, "Lower air pressure lowers the boiling point of water.");
export const SWITCH = claim(4, "A bimetallic strip bends when hot and switches the kettle off.");
export const CLAIMS = [ELEMENT, BOILING, PRESSURE, SWITCH];

/** The user message of a recorded request, where the lesson facts and learner's words go. */
export const userPrompt = (request: { messages: { content: unknown }[] } | undefined) =>
  String(request?.messages.at(1)?.content);

export const LESSON = {
  lessonId: "0192f1a0-0000-7000-8000-00000000a001",
  version: 2,
  title: "How a kettle boils water",
  summary: "An element heats water until it boils, then a switch turns it off.",
  claims: CLAIMS,
};

export const QUESTION = {
  sessionId: "0192f1a0-0000-7000-8000-00000000b001",
  lessonId: LESSON.lessonId,
  lessonVersion: LESSON.version,
  text: "Why does lower air pressure change boiling?",
  audience: "general" as const,
  readingLevel: "plain" as const,
  locale: "en",
};

/** Replies with each scripted text in turn and records what it was asked. */
export function scriptedProvider(replies: string[]) {
  const requests: Parameters<LlmProvider["complete"]>[0][] = [];
  const provider: LlmProvider = {
    id: "scripted",
    model: "scripted-1",
    async complete(request) {
      requests.push(request);
      const text = replies.shift();
      if (text === undefined) throw new Error("no scripted reply left");
      return {
        text,
        model: "scripted-1@2026",
        usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
        latencyMs: 1,
      };
    },
  };
  return { provider, requests };
}

export const reply = (text: string, cited: string[]) => JSON.stringify({ text, cited });

export function classifierSaying(overrides: Partial<RiskAssessment> = {}): RiskClassifier {
  return async () => ({
    safetyClass: "low",
    categories: [],
    intent: "learn",
    suitableFor: "everyone",
    source: "rules",
    policyVersion: "safety-2",
    ...overrides,
  });
}
