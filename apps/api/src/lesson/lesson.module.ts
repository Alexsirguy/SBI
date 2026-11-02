import { Logger, Module } from "@nestjs/common";
import type { DatabaseHandle, Repositories } from "@sbi/db";
import {
  META_MODEL_API_BASE_URL,
  OPENAI_BASE_URL,
  createOpenAiCompatibleProvider,
  type LlmEventSink,
  type LlmProvider,
} from "@sbi/llm";
import type { RightsGate } from "@sbi/orchestrator";
import { createRightsRegister, LIBRARY_ASSET_IDS } from "@sbi/rights";
import { createRiskClassifier } from "@sbi/safety";
import { RENDERER_LIBRARIES, type VisualManifestRepository } from "@sbi/visuals";
import { memoryPubChemCache } from "@sbi/visuals/server";
import type { ApiEnv } from "../env";
import { TaxonomyModule } from "../taxonomy/taxonomy.module";
import {
  API_ENV,
  DATABASE,
  LESSON_EVIDENCE,
  FEEDBACK_LIMITER,
  QUESTIONS_LIMITER,
  LESSON_FEEDBACK,
  LESSON_GATHERER,
  LESSON_RIGHTS,
  LESSON_LLM,
  LESSON_REVIEW_AUDIT,
  LESSONS,
  REPOSITORIES,
  RISK_CLASSIFIER,
  VISUAL_MAKER,
  VISUAL_MANIFESTS,
} from "../tokens";
import { createRateLimiter } from "../common/rate-limiter";
import { createEvidenceGatherer } from "./evidence-gatherer";
import { LessonFeedbackController } from "./feedback.controller";
import { LessonController } from "./lesson.controller";
import { LessonService } from "./lesson.service";
import { QuestionsController } from "./questions.controller";
import { createVisualMaker } from "../visuals/visual-maker";
import { VisualsModule } from "../visuals/visuals.module";

const logger = new Logger("LessonLlm");

// Versions, usage and outcome only; the event type carries no message text.
const logEvent: LlmEventSink = (event) => logger.log(JSON.stringify(event));

// Without a key and a model the API still serves everything else; /lessons answers 503.
export function lessonProviderFor(env: Pick<ApiEnv, "lessonSource">): LlmProvider | null {
  const { META_MODEL_API_KEY, OPENAI_API_KEY, LESSON_MODEL } = env.lessonSource;
  if (!LESSON_MODEL) return null;
  if (META_MODEL_API_KEY) {
    return createOpenAiCompatibleProvider({
      id: "lesson-meta",
      baseUrl: META_MODEL_API_BASE_URL,
      apiKey: META_MODEL_API_KEY,
      model: LESSON_MODEL,
      extraBody: { reasoning_effort: "low" },
      timeoutMs: 60_000,
      onEvent: logEvent,
    });
  }
  if (OPENAI_API_KEY) {
    return createOpenAiCompatibleProvider({
      id: "lesson-openai",
      baseUrl: OPENAI_BASE_URL,
      apiKey: OPENAI_API_KEY,
      model: LESSON_MODEL,
      maxTokensParam: "max_completion_tokens",
      // ADR 0006: OpenAI must not keep learner questions or lesson drafts.
      extraBody: { reasoning_effort: "low", store: false },
      timeoutMs: 60_000,
      onEvent: logEvent,
    });
  }
  return null;
}

@Module({
  imports: [TaxonomyModule, VisualsModule],
  controllers: [LessonController, LessonFeedbackController, QuestionsController],
  providers: [
    LessonService,
    {
      provide: LESSON_LLM,
      inject: [API_ENV],
      useFactory: lessonProviderFor,
    },
    {
      provide: RISK_CLASSIFIER,
      inject: [LESSON_LLM],
      useFactory: (provider: LlmProvider | null) =>
        createRiskClassifier({
          provider,
          // The reason only; the learner's words never reach the logs.
          onFallback: (error) =>
            logger.warn(`Risk classifier fell back to rules: ${(error as Error)?.name}`),
        }),
    },
    {
      provide: LESSONS,
      inject: [REPOSITORIES],
      useFactory: (repos: Repositories) => repos.lessons,
    },
    {
      provide: FEEDBACK_LIMITER,
      inject: [API_ENV],
      useFactory: (env: Pick<ApiEnv, "FEEDBACK_MAX_PER_HOUR">) =>
        createRateLimiter({ limit: env.FEEDBACK_MAX_PER_HOUR, windowMs: 3_600_000 }),
    },
    {
      provide: QUESTIONS_LIMITER,
      inject: [API_ENV],
      useFactory: (env: Pick<ApiEnv, "QUESTIONS_MAX_PER_HOUR">) =>
        createRateLimiter({ limit: env.QUESTIONS_MAX_PER_HOUR, windowMs: 3_600_000 }),
    },
    {
      provide: LESSON_FEEDBACK,
      inject: [REPOSITORIES],
      useFactory: (repos: Repositories) => repos.lessonFeedback,
    },
    {
      provide: LESSON_REVIEW_AUDIT,
      inject: [REPOSITORIES],
      useFactory: (repos: Repositories) => repos.reviewAudit,
    },
    {
      provide: LESSON_GATHERER,
      inject: [LESSON_LLM, API_ENV, REPOSITORIES, DATABASE],
      useFactory: (
        provider: LlmProvider | null,
        env: ApiEnv,
        repositories: Repositories,
        database: DatabaseHandle,
      ) => createEvidenceGatherer({ provider, env, repositories, database }),
    },
    {
      provide: LESSON_RIGHTS,
      inject: [REPOSITORIES, VISUAL_MANIFESTS],
      // Typed as the gate the publisher calls, so a mismatch fails the build instead of a lesson.
      useFactory: (repos: Repositories, manifests: VisualManifestRepository): RightsGate =>
        createRightsRegister({
          assets: repos.visualAssets,
          manifests,
          // An unknown library name maps to an id with no record, so the gate blocks it.
          librariesFor: (kind) =>
            RENDERER_LIBRARIES[kind].map((name) => LIBRARY_ASSET_IDS[name] ?? `missing:${name}`),
        }),
    },
    {
      provide: VISUAL_MAKER,
      inject: [LESSON_LLM, REPOSITORIES, VISUAL_MANIFESTS, LESSON_RIGHTS],
      useFactory: (
        provider: LlmProvider | null,
        repos: Repositories,
        manifests: VisualManifestRepository,
        rights: RightsGate,
      ) =>
        createVisualMaker({
          provider,
          manifests,
          assets: repos.visualAssets,
          lessons: repos.lessons,
          rights,
          // One lookup per molecule name for the life of the process; manifests keep the result.
          pubchem: memoryPubChemCache(),
        }),
    },
    {
      provide: LESSON_EVIDENCE,
      inject: [REPOSITORIES],
      useFactory: (repos: Repositories) => ({
        claims: repos.claims,
        sources: repos.evidenceSources,
      }),
    },
  ],
})
export class LessonModule {}
