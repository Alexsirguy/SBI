import { createLlmSupportJudge, type SupportJudge } from "@sbi/evidence";
import { createOpenAiCompatibleProvider } from "@sbi/llm";
import { assertNoTrainingReuse, RECOGNITION_PROVIDERS } from "@sbi/recognition";

export interface JudgeKeys {
  META_MODEL_API_KEY?: string;
  OPENAI_API_KEY?: string;
}

/** The support judge on the ADR 0006 vendors: Meta Spark when its key is set, else GPT-5.4-mini. */
export function createEvidenceJudge(keys: JudgeKeys, fetchImpl?: typeof fetch): SupportJudge {
  const config = RECOGNITION_PROVIDERS.find((provider) => keys[provider.apiKeyEnv]);
  if (!config) {
    throw new Error("The evidence judge needs META_MODEL_API_KEY or OPENAI_API_KEY");
  }
  assertNoTrainingReuse(config);
  return createLlmSupportJudge(
    createOpenAiCompatibleProvider({
      id: config.id,
      baseUrl: config.baseUrl,
      apiKey: keys[config.apiKeyEnv] ?? "",
      model: config.model,
      maxTokensParam: config.maxTokensParam,
      extraBody: config.extraBody,
      retries: 1,
      fetchImpl,
    }),
  );
}
