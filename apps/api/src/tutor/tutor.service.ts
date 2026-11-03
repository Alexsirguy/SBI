import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import type { TutorExchange, TutorTurn, TutorTurnRequest } from "@sbi/contracts";
import type { LlmProvider } from "@sbi/llm";
import type { LessonRepository } from "@sbi/orchestrator";
import type { RiskClassifier } from "@sbi/safety";
import { runTutorTurn, type TutorTurnRepository } from "@sbi/tutor";
import type { z } from "zod";
import type { RateLimiter } from "../common/rate-limiter";
import { UserFacingException } from "../common/user-facing.exception";
import type { ApiEnv } from "../env";
import {
  API_ENV,
  LESSON_LLM,
  LESSONS,
  RISK_CLASSIFIER,
  TUTOR_LIMITER,
  TUTOR_TURNS,
} from "../tokens";
import { tutorText } from "./tutor-text";

const logger = new Logger("Tutor");

// The learner is waiting in a chat, so a stalled model gives way to "try again".
const TURN_TIMEOUT_MS = 30_000;

/** Turns saved before replies had a kind read as lesson or beyond by their citations. */
export function toExchange(turn: TutorTurn, locale?: string): TutorExchange {
  const cited = turn.response.citedClaimIds;
  const kind = turn.response.kind ?? (cited.length > 0 ? "lesson" : "beyond-lesson");
  return {
    turnId: turn.turnId,
    userText: turn.userText,
    text: turn.response.text,
    citedClaimIds: cited,
    kind,
    ...(kind === "beyond-lesson" ? { note: tutorText(locale).beyondLesson } : {}),
    ...(turn.response.policy ? { policy: turn.response.policy } : {}),
    createdAt: turn.createdAt,
  };
}

@Injectable()
export class TutorService {
  constructor(
    @Inject(API_ENV) private readonly env: Pick<ApiEnv, "features">,
    @Inject(LESSONS) private readonly lessons: Pick<LessonRepository, "get">,
    @Inject(LESSON_LLM) private readonly provider: LlmProvider | null,
    @Inject(RISK_CLASSIFIER) private readonly classify: RiskClassifier,
    @Inject(TUTOR_TURNS) private readonly turns: TutorTurnRepository,
    @Inject(TUTOR_LIMITER) private readonly limiter: RateLimiter,
  ) {}

  private available(locale?: string): LlmProvider {
    if (!this.env.features.tutor || !this.provider) {
      throw new UserFacingException(tutorText(locale).unavailable, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return this.provider;
  }

  async ask(request: z.output<typeof TutorTurnRequest>, client: string): Promise<TutorExchange> {
    const text = tutorText(request.locale);
    const provider = this.available(request.locale);
    if (!this.limiter.allow(client)) {
      throw new UserFacingException(text.tooMany, HttpStatus.TOO_MANY_REQUESTS);
    }
    const lesson = await this.lessons.get(request.lessonId, request.lessonVersion);
    if (!lesson) throw new UserFacingException(text.noLesson, HttpStatus.NOT_FOUND);
    const history = await this.turns.listBySession(request.sessionId);
    let turn: TutorTurn;
    try {
      turn = await runTutorTurn(
        { provider, classify: this.classify, signal: AbortSignal.timeout(TURN_TIMEOUT_MS) },
        { lesson, question: request, history },
      );
    } catch (error) {
      // The failure's name only; the learner's words never reach the logs.
      logger.warn(`Tutor turn failed: ${(error as Error)?.name ?? "unknown"}`);
      throw new UserFacingException(text.unavailable, HttpStatus.SERVICE_UNAVAILABLE);
    }
    await this.turns.save(turn);
    return toExchange(turn, request.locale);
  }

  async conversation(
    sessionId: string,
    lessonId: string,
    locale?: string,
  ): Promise<TutorExchange[]> {
    this.available(locale);
    const turns = await this.turns.listBySession(sessionId);
    return turns
      .filter((turn) => turn.lessonId === lessonId)
      .map((turn) => toExchange(turn, locale));
  }
}
