import { createEnv, type EnvSource } from "@sbi/env";
import { createOpenAiCompatibleProvider, META_MODEL_API_BASE_URL, OPENAI_BASE_URL } from "@sbi/llm";
import { z } from "zod";
import { createFallbackRecogniser, type FallbackRecogniser } from "./fallback";
import { createVisionLlmRecogniser } from "./vision-llm-recogniser";

export interface RecognitionProviderConfig {
  id: string;
  model: string;
  baseUrl: string;
  apiKeyEnv: "META_MODEL_API_KEY" | "OPENAI_API_KEY";
  maxTokensParam: "max_tokens" | "max_completion_tokens";
  extraBody: Record<string, unknown>;
}

// Order and models from ADR 0006. Meta Standard mode does not train on content; `store: false`
// keeps OpenAI from retaining completions for evals or distillation.
export const RECOGNITION_PROVIDERS: readonly RecognitionProviderConfig[] = [
  {
    id: "meta-spark",
    model: "muse-spark-1.3",
    baseUrl: META_MODEL_API_BASE_URL,
    apiKeyEnv: "META_MODEL_API_KEY",
    maxTokensParam: "max_tokens",
    extraBody: { reasoning_effort: "low" },
  },
  {
    id: "openai-mini",
    model: "gpt-5.4-mini",
    baseUrl: OPENAI_BASE_URL,
    apiKeyEnv: "OPENAI_API_KEY",
    maxTokensParam: "max_completion_tokens",
    extraBody: { reasoning_effort: "low", store: false },
  },
];

/** Learner photos must never be sent in a mode that lets the vendor train on or keep them. */
export function assertNoTrainingReuse(config: RecognitionProviderConfig): void {
  if (/contributor/i.test(config.model)) {
    throw new Error(`${config.id}: contributor-mode models train on content`);
  }
  if (config.extraBody.store === true) {
    throw new Error(`${config.id}: store: true lets the vendor keep completions`);
  }
}

const schema = z.object({
  META_MODEL_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  RECOGNITION_PROVIDERS: z.string().default(RECOGNITION_PROVIDERS.map((p) => p.id).join(",")),
  // Above Meta Spark's benchmarked p95 of 17 s, so the fallback covers outages rather than tail latency.
  RECOGNITION_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
});

export function createRecognitionProvider(
  source: EnvSource,
  { fetchImpl }: { fetchImpl?: typeof fetch } = {},
): FallbackRecogniser {
  const env = createEnv(schema, source);
  const ids = env.RECOGNITION_PROVIDERS.split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const configs = ids.map((id) => {
    const config = RECOGNITION_PROVIDERS.find((provider) => provider.id === id);
    if (!config) {
      throw new Error(
        `Unknown recognition provider ${id}; choose from ${RECOGNITION_PROVIDERS.map((p) => p.id).join(", ")}`,
      );
    }
    return config;
  });
  const providers = configs.flatMap((config) => {
    const apiKey = env[config.apiKeyEnv];
    if (!apiKey) {
      return [];
    }
    assertNoTrainingReuse(config);
    return [
      createVisionLlmRecogniser(
        createOpenAiCompatibleProvider({
          id: config.id,
          baseUrl: config.baseUrl,
          apiKey,
          model: config.model,
          maxTokensParam: config.maxTokensParam,
          extraBody: config.extraBody,
          // One retry at most: the fallback provider is the better second attempt.
          retries: 1,
          fetchImpl,
        }),
      ),
    ];
  });
  if (providers.length === 0) {
    throw new Error("Recognition needs META_MODEL_API_KEY or OPENAI_API_KEY");
  }
  return createFallbackRecogniser(providers, { timeoutMs: env.RECOGNITION_TIMEOUT_MS });
}
