import {
  createOpenAiCompatibleProvider,
  META_MODEL_API_BASE_URL,
  OPENAI_BASE_URL,
  type LlmProvider,
  type Usage,
} from "@sbi/llm";

export interface Pricing {
  input: number;
  cachedInput: number;
  output: number;
  source: string;
}

export interface ProviderConfig {
  id: string;
  vendor: "meta" | "openai";
  model: string;
  baseUrl: string;
  apiKeyEnv: string;
  maxTokensParam: "max_tokens" | "max_completion_tokens";
  extraBody: Record<string, unknown>;
  // USD per million tokens.
  pricing: Pricing;
}

const META_PRICING = "https://dev.meta.ai/docs/pricing-rate-limits";
const OPENAI_PRICING = "https://openai.com/api/pricing";

// Contributor-mode Meta models are excluded on purpose: they allow training on our learners' content.
export const PROVIDERS: readonly ProviderConfig[] = [
  {
    id: "meta-spark",
    vendor: "meta",
    model: "muse-spark-1.3",
    baseUrl: META_MODEL_API_BASE_URL,
    apiKeyEnv: "META_MODEL_API_KEY",
    maxTokensParam: "max_tokens",
    extraBody: { reasoning_effort: "low" },
    pricing: { input: 1.25, cachedInput: 0.15, output: 4.25, source: META_PRICING },
  },
  {
    id: "meta-wonder",
    vendor: "meta",
    model: "muse-wonder-1.0",
    baseUrl: META_MODEL_API_BASE_URL,
    apiKeyEnv: "META_MODEL_API_KEY",
    maxTokensParam: "max_tokens",
    extraBody: { reasoning_effort: "low" },
    pricing: { input: 4, cachedInput: 0.2, output: 20, source: META_PRICING },
  },
  {
    id: "openai-main",
    vendor: "openai",
    model: "gpt-5.4",
    baseUrl: OPENAI_BASE_URL,
    apiKeyEnv: "OPENAI_API_KEY",
    maxTokensParam: "max_completion_tokens",
    extraBody: { reasoning_effort: "low" },
    pricing: { input: 2.5, cachedInput: 0.25, output: 15, source: OPENAI_PRICING },
  },
  {
    id: "openai-mini",
    vendor: "openai",
    model: "gpt-5.4-mini",
    baseUrl: OPENAI_BASE_URL,
    apiKeyEnv: "OPENAI_API_KEY",
    maxTokensParam: "max_completion_tokens",
    extraBody: { reasoning_effort: "low" },
    pricing: { input: 0.75, cachedInput: 0.075, output: 4.5, source: OPENAI_PRICING },
  },
];

export function costUsd(usage: Usage, pricing: Pricing): number {
  const uncached = usage.inputTokens - usage.cachedInputTokens;
  return (
    (uncached * pricing.input +
      usage.cachedInputTokens * pricing.cachedInput +
      usage.outputTokens * pricing.output) /
    1_000_000
  );
}

export function createProvider(
  config: ProviderConfig,
  env: Record<string, string | undefined>,
  model: string = config.model,
): LlmProvider {
  const apiKey = env[config.apiKeyEnv];
  if (!apiKey) throw new Error(`${config.id} needs ${config.apiKeyEnv}`);
  return createOpenAiCompatibleProvider({
    id: config.id,
    baseUrl: config.baseUrl,
    apiKey,
    model,
    maxTokensParam: config.maxTokensParam,
    extraBody: config.extraBody,
  });
}
