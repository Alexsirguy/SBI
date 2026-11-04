import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import type { Lesson, TutorExchange, TutorTurn, TutorTurnRequest } from "@sbi/contracts";
import type { LlmProvider } from "@sbi/llm";
import type { LessonRepository } from "@sbi/orchestrator";
import type { RiskClassifier } from "@sbi/safety";
import type { VisualManifestRepository } from "@sbi/visuals";
import {
  cooldownRemaining,
  runTutorTurn,
  type ConversationOwner,
  type StrikeCounter,
  type TutorTurnRepository,
} from "@sbi/tutor";
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
  TUTOR_STRIKES,
  TUTOR_TURNS,
  VISUAL_MANIFESTS,
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
    ...(turn.response.visualAction ? { visualAction: turn.response.visualAction } : {}),
    createdAt: turn.createdAt,
  };
}

// Signed in, the account's conversation follows the learner across visits and devices.
const owner = (sessionId: string, accountId?: string): ConversationOwner =>
  accountId ? { accountId } : { sessionId };

@Injectable()
export class TutorService {
  constructor(
    @Inject(API_ENV) private readonly env: Pick<ApiEnv, "features">,
    @Inject(LESSONS) private readonly lessons: Pick<LessonRepository, "get">,
    @Inject(LESSON_LLM) private readonly provider: LlmProvider | null,
    @Inject(RISK_CLASSIFIER) private readonly classify: RiskClassifier,
    @Inject(TUTOR_TURNS) private readonly turns: TutorTurnRepository,
    @Inject(TUTOR_LIMITER) private readonly limiter: RateLimiter,
    @Inject(TUTOR_STRIKES) private readonly strikes: StrikeCounter,
    @Inject(VISUAL_MANIFESTS) private readonly manifests: Pick<VisualManifestRepository, "get">,
  ) {}

  // The same visual the lesson page drives: a stage diagram has no sliders to move.
  private async experimentVisual(lesson: Lesson) {
    const ref = lesson.visuals.find((visual) => visual.kind !== "process");
    return ref ? this.manifests.get(ref.visualId).catch(() => undefined) : undefined;
  }

  private available(locale?: string): LlmProvider {
    if (!this.env.features.tutor || !this.provider) {
      throw new UserFacingException(tutorText(locale).unavailable, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return this.provider;
  }

  async ask(
    request: z.output<typeof TutorTurnRequest>,
    client: string,
    accountId?: string,
  ): Promise<TutorExchange> {
    const text = tutorText(request.locale);
    const provider = this.available(request.locale);
    if (!this.limiter.allow(client)) {
      throw new UserFacingException(text.tooMany, HttpStatus.TOO_MANY_REQUESTS);
    }
    const lesson = await this.lessons.get(request.lessonId, request.lessonVersion);
    if (!lesson) throw new UserFacingException(text.noLesson, HttpStatus.NOT_FOUND);
    const [visit, history] = await Promise.all([
      this.turns.listBySession(request.sessionId),
      this.turns.listConversation(owner(request.sessionId, accountId), request.lessonId),
    ]);
    const wait = Math.max(
      cooldownRemaining(
        [...new Map([...visit, ...history].map((turn) => [turn.turnId, turn])).values()],
        new Date(),
      ),
      this.strikes.remaining(client),
    );
    if (wait > 0) {
      const minutes = Math.ceil(wait / 60_000);
      throw new UserFacingException(text.coolingDown(minutes), HttpStatus.TOO_MANY_REQUESTS);
    }
    let turn: TutorTurn;
    try {
      turn = await runTutorTurn(
        { provider, classify: this.classify, signal: AbortSignal.timeout(TURN_TIMEOUT_MS) },
        {
          lesson,
          question: request,
          history,
          manifest: await this.experimentVisual(lesson),
          ...(accountId ? { accountId } : {}),
        },
      );
    } catch (error) {
      // The failure's name only; the learner's words never reach the logs.
      logger.warn(`Tutor turn failed: ${(error as Error)?.name ?? "unknown"}`);
      throw new UserFacingException(text.unavailable, HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (turn.response.policy?.reason === "harm") this.strikes.strike(client);
    await this.turns.save(turn);
    return toExchange(turn, request.locale);
  }

  async conversation(
    query: { sessionId: string; lessonId: string; locale?: string },
    accountId?: string,
  ): Promise<TutorExchange[]> {
    this.available(query.locale);
    const turns = await this.turns.listConversation(
      owner(query.sessionId, accountId),
      query.lessonId,
    );
    return turns.map((turn) => toExchange(turn, query.locale));
  }

  /** Works even with the tutor switched off, so a learner can always clear what was kept. */
  async reset(sessionId: string, lessonId: string, accountId?: string): Promise<number> {
    const visit = await this.turns.deleteConversation({ sessionId }, lessonId);
    const account = accountId ? await this.turns.deleteConversation({ accountId }, lessonId) : 0;
    return visit + account;
  }
}
