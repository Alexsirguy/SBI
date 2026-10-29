import type { LlmProvider } from "@sbi/llm";
import { z } from "zod";

export const SUPPORT_PROMPT_VERSION = "evidence-judge-p0.1";

export const SupportVerdict = z.object({
  verdict: z.enum(["supports", "contradicts", "insufficient"]),
  reason: z.string().min(1).max(300),
});

export type SupportVerdict = z.infer<typeof SupportVerdict>;

export interface SupportQuestion {
  claim: string;
  scope: string;
  excerpt: string;
  location: string;
  sourceTitle: string;
}

/** Decides whether one stored excerpt, on its own, backs one claim. */
export interface SupportJudge {
  readonly version: string;
  judge(question: SupportQuestion, options?: { signal?: AbortSignal }): Promise<SupportVerdict>;
}

const SYSTEM_PROMPT = `You check facts for a science-learning app. You get one claim and one excerpt from a trusted source.
Judge only from the excerpt. Ignore anything you know that the excerpt does not say.
- "supports": the excerpt states the claim, or something that directly implies it, within the claim's scope. Figures, dates and names must match; rounding is fine only when the claim says "about" or "roughly".
- "contradicts": the excerpt states something incompatible with the claim.
- "insufficient": anything else, including excerpts that are merely on the same topic.
reason: one short sentence quoting or pointing at the deciding words.`;

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "reason"],
  properties: {
    verdict: { type: "string", enum: ["supports", "contradicts", "insufficient"] },
    reason: { type: "string" },
  },
};

export function createLlmSupportJudge(llm: LlmProvider): SupportJudge {
  return {
    version: `${llm.model}+${SUPPORT_PROMPT_VERSION}`,
    async judge(question, options = {}) {
      const completion = await llm.complete({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              `Claim: ${question.claim}`,
              `Scope: ${question.scope}`,
              `Source: ${question.sourceTitle} (${question.location})`,
              `Excerpt: """${question.excerpt}"""`,
            ].join("\n"),
          },
        ],
        jsonSchema: { name: "SupportVerdict", schema: OUTPUT_SCHEMA },
        maxTokens: 600,
        signal: options.signal,
      });
      let raw: unknown;
      try {
        raw = JSON.parse(completion.text);
      } catch {
        raw = undefined;
      }
      const parsed = SupportVerdict.safeParse(raw);
      // A malformed answer is not support; the claim falls back to an open question.
      return parsed.success
        ? parsed.data
        : { verdict: "insufficient", reason: "Unreadable verdict." };
    },
  };
}
