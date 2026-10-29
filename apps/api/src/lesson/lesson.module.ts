import { Logger, Module } from "@nestjs/common";
import type { Repositories } from "@sbi/db";
import {
  META_MODEL_API_BASE_URL,
  OPENAI_BASE_URL,
  createOpenAiCompatibleProvider,
  type LlmEventSink,
  type LlmProvider,
} from "@sbi/llm";
import type { ApiEnv } from "../env";
import { TaxonomyModule } from "../taxonomy/taxonomy.module";
import {
  API_ENV,
  LESSON_EVIDENCE,
  LESSON_LLM,
  LESSON_REVIEW_AUDIT,
  LESSONS,
  REPOSITORIES,
} from "../tokens";
import { LessonController } from "./lesson.controller";
import { LessonService } from "./lesson.service";

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
      timeoutMs: 60_000,
      onEvent: logEvent,
    });
  }
  return null;
}

@Module({
  imports: [TaxonomyModule],
  controllers: [LessonController],
  providers: [
    LessonService,
    {
      provide: LESSON_LLM,
      inject: [API_ENV],
      useFactory: lessonProviderFor,
    },
    {
      provide: LESSONS,
      inject: [REPOSITORIES],
      useFactory: (repos: Repositories) => repos.lessons,
    },
    {
      provide: LESSON_REVIEW_AUDIT,
      inject: [REPOSITORIES],
      useFactory: (repos: Repositories) => repos.reviewAudit,
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
