import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import {
  API_ROUTES,
  type ApiResponse,
  LessonFeedbackRequest,
  type LessonFeedbackRequest as FeedbackBody,
} from "@sbi/contracts";
import type { LessonFeedbackRepository } from "@sbi/db";
import type { LessonRepository } from "@sbi/orchestrator";
import { UserFacingException } from "../common/user-facing.exception";
import { ZodPipe } from "../common/zod.pipe";
import { LESSON_FEEDBACK, LESSONS } from "../tokens";

@Controller()
export class LessonFeedbackController {
  constructor(
    @Inject(LESSON_FEEDBACK) private readonly feedback: LessonFeedbackRepository,
    @Inject(LESSONS) private readonly lessons: Pick<LessonRepository, "get">,
  ) {}

  @Post(API_ROUTES.submitLessonFeedback.path)
  @HttpCode(200)
  async submit(
    @Body(new ZodPipe(LessonFeedbackRequest, "Choose a problem to report or rate the lesson."))
    body: FeedbackBody,
  ): Promise<ApiResponse<"submitLessonFeedback">> {
    // Feedback must name a lesson version learners were actually shown, or triage cannot use it.
    if (!(await this.lessons.get(body.lessonId, body.version))) {
      throw new UserFacingException("We could not find that lesson.", HttpStatus.NOT_FOUND);
    }
    const stored = await this.feedback.record(body, new Date());
    return { feedbackId: stored.feedbackId, receivedAt: stored.receivedAt };
  }
}
