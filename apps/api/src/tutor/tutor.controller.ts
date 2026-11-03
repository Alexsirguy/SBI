import { Body, Controller, Get, HttpCode, Inject, Ip, Post, Query } from "@nestjs/common";
import {
  API_ROUTES,
  TutorConversationRequest,
  TutorTurnRequest,
  type ApiResponse,
} from "@sbi/contracts";
import type { z } from "zod";
import { ZodPipe } from "../common/zod.pipe";
import { TutorService } from "./tutor.service";

@Controller()
export class TutorController {
  constructor(@Inject(TutorService) private readonly tutor: TutorService) {}

  @Post(API_ROUTES.askTutor.path)
  @HttpCode(200)
  async ask(
    @Body(new ZodPipe(TutorTurnRequest, "Ask a question of a few words about this lesson."))
    request: z.output<typeof TutorTurnRequest>,
    @Ip() ip: string,
  ): Promise<ApiResponse<"askTutor">> {
    return { exchange: await this.tutor.ask(request, ip) };
  }

  @Get(API_ROUTES.tutorConversation.path)
  async conversation(
    @Query(new ZodPipe(TutorConversationRequest, "Name the visit and the lesson."))
    { sessionId, lessonId, locale }: z.output<typeof TutorConversationRequest>,
  ): Promise<ApiResponse<"tutorConversation">> {
    return { exchanges: await this.tutor.conversation(sessionId, lessonId, locale) };
  }
}
