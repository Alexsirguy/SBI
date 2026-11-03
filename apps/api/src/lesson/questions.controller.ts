import { Body, Controller, HttpCode, Inject, Ip, Logger, Post } from "@nestjs/common";
import {
  API_ROUTES,
  type ApiResponse,
  fixedQuestions,
  QuestionSuggestionRequest,
  type ApiRequest,
} from "@sbi/contracts";
import type { LlmProvider } from "@sbi/llm";
import { suggestQuestions } from "@sbi/orchestrator";
import type { RateLimiter } from "../common/rate-limiter";
import { ZodPipe } from "../common/zod.pipe";
import { LESSON_LLM, QUESTIONS_LIMITER } from "../tokens";

const logger = new Logger("QuestionSuggestions");

// The learner is waiting on the choice step, so a slow model gives way to the fixed questions.
const SUGGEST_TIMEOUT_MS = 10_000;

@Controller()
export class QuestionsController {
  constructor(
    @Inject(LESSON_LLM) private readonly provider: LlmProvider | null,
    @Inject(QUESTIONS_LIMITER) private readonly limiter: RateLimiter,
  ) {}

  @Post(API_ROUTES.suggestQuestions.path)
  @HttpCode(200)
  async suggest(
    @Body(new ZodPipe(QuestionSuggestionRequest, "Name the object in a few words."))
    body: ApiRequest<"suggestQuestions">,
    @Ip() ip: string,
  ): Promise<ApiResponse<"suggestQuestions">> {
    const request = QuestionSuggestionRequest.parse(body);
    const fixed = {
      questions: fixedQuestions(request.subject, request.locale),
      source: "fixed" as const,
    };
    // Each request costs a model call; past the limit the learner still gets questions to pick.
    if (!this.limiter.allow(ip)) return fixed;
    try {
      return await suggestQuestions(request, {
        provider: this.provider,
        signal: AbortSignal.timeout(SUGGEST_TIMEOUT_MS),
      });
    } catch (error) {
      // The message names the failure, never the object the learner named.
      logger.warn(`Fixed questions stood in: ${String((error as Error)?.message ?? error)}`);
      return fixed;
    }
  }
}
