import { createHash } from "node:crypto";
import type { AudienceBand } from "@sbi/contracts";
import type { LlmProvider } from "@sbi/llm";
import { z } from "zod";

export const Intent = z.object({ id: z.string().min(1), keywords: z.array(z.string().min(1)) });

export const CacheQuery = z.object({
  taxonomyId: z.string().min(1),
  question: z.string().min(1),
  audience: z.enum(["child", "teen", "adult", "general"]),
});

export const CacheFixture = z.object({
  catalog: z.record(z.string(), z.array(Intent).min(1)),
  pairs: z.array(
    z.object({ a: CacheQuery, b: CacheQuery, sameIntent: z.boolean(), note: z.string() }),
  ),
});

export type Intent = z.infer<typeof Intent>;
export type CacheQuery = z.infer<typeof CacheQuery>;
export type CacheFixture = z.infer<typeof CacheFixture>;
export type IntentClassifier = (query: CacheQuery) => Promise<string | null>;

const READING_LEVEL: Record<AudienceBand, string> = {
  child: "simple",
  teen: "plain",
  adult: "plain",
  general: "plain",
};

/** Stable cache key for a lesson: same object, intent and audience give the same key. */
export function intentSignature(taxonomyId: string, intentId: string, audience: AudienceBand) {
  const parts = [taxonomyId, intentId, audience, READING_LEVEL[audience]].join("|");
  return createHash("sha256").update(parts).digest("hex");
}

const words = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

// Returns null on a tie or no hit so an unclear question regenerates instead of reusing a wrong lesson.
export function keywordIntent(question: string, intents: Intent[]): string | null {
  const tokens = new Set(words(question));
  const scored = intents
    .map((intent) => ({
      id: intent.id,
      score: intent.keywords.filter((keyword) =>
        keyword.includes(" ") ? question.toLowerCase().includes(keyword) : tokens.has(keyword),
      ).length,
    }))
    .sort((a, b) => b.score - a.score);
  const [best, next] = scored;
  if (!best || best.score === 0 || best.score === next?.score) return null;
  return best.id;
}

export function keywordClassifier(catalog: CacheFixture["catalog"]): IntentClassifier {
  return async (query) => keywordIntent(query.question, catalog[query.taxonomyId] ?? []);
}

export function llmClassifier(
  llm: LlmProvider,
  catalog: CacheFixture["catalog"],
): IntentClassifier {
  return async (query) => {
    const ids = (catalog[query.taxonomyId] ?? []).map((intent) => intent.id);
    const completion = await llm.complete({
      messages: [
        {
          role: "system",
          content: `Classify which question a learner is asking about an object. Answer with the matching intent id, or "other" if none fits clearly.`,
        },
        {
          role: "user",
          content: `Object: ${query.taxonomyId}\nIntents: ${ids.join(", ")}\nQuestion: ${query.question}`,
        },
      ],
      jsonSchema: {
        name: "Intent",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["intent"],
          properties: { intent: { type: "string", enum: [...ids, "other"] } },
        },
      },
      // Reasoning models spend part of this budget thinking before they answer.
      maxTokens: 4000,
    });
    const intent = (JSON.parse(completion.text) as { intent: string }).intent;
    return intent === "other" ? null : intent;
  };
}

/** Treats a failed classification as "no match", so the lesson is regenerated instead of reused. */
export function safeClassifier(
  classify: IntentClassifier,
  errors: string[] = [],
): IntentClassifier {
  return async (query) => {
    try {
      return await classify(query);
    } catch (error) {
      errors.push(String(error).slice(0, 200));
      return null;
    }
  };
}

export interface CacheResult {
  pairs: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  trueNegative: number;
  precision: number | null;
  recall: number | null;
  misses: string[];
}

/** A pair should share a cache entry only when the intent and audience both match. */
export async function evaluateCache(
  fixture: CacheFixture,
  classify: IntentClassifier,
): Promise<CacheResult> {
  const result: CacheResult = {
    pairs: fixture.pairs.length,
    truePositive: 0,
    falsePositive: 0,
    falseNegative: 0,
    trueNegative: 0,
    precision: null,
    recall: null,
    misses: [],
  };
  for (const pair of fixture.pairs) {
    const [intentA, intentB] = await Promise.all([classify(pair.a), classify(pair.b)]);
    const key = (query: CacheQuery, intent: string | null) =>
      intent ? intentSignature(query.taxonomyId, intent, query.audience) : null;
    const keyA = key(pair.a, intentA);
    const matched = keyA !== null && keyA === key(pair.b, intentB);
    const expected =
      pair.sameIntent &&
      pair.a.audience === pair.b.audience &&
      pair.a.taxonomyId === pair.b.taxonomyId;
    if (matched && expected) result.truePositive += 1;
    else if (matched) result.falsePositive += 1;
    else if (expected) result.falseNegative += 1;
    else result.trueNegative += 1;
    if (matched !== expected)
      result.misses.push(`${pair.note} (${intentA ?? "none"} / ${intentB ?? "none"})`);
  }
  const hits = result.truePositive + result.falsePositive;
  const wanted = result.truePositive + result.falseNegative;
  result.precision = hits ? result.truePositive / hits : null;
  result.recall = wanted ? result.truePositive / wanted : null;
  return result;
}
