import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Ip,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  API_ROUTES,
  TutorConversationRequest,
  TutorResetRequest,
  TutorTurnRequest,
  type ApiResponse,
} from "@sbi/contracts";
import type { z } from "zod";
import { SameOriginGuard, sessionToken, type SessionRequest } from "../account/account.guard";
import { AuthService } from "../account/auth.service";
import { ZodPipe } from "../common/zod.pipe";
import { TutorService } from "./tutor.service";

@Controller()
@UseGuards(SameOriginGuard)
export class TutorController {
  constructor(
    @Inject(TutorService) private readonly tutor: TutorService,
    @Inject(AuthService) private readonly auth: Pick<AuthService, "current">,
  ) {}

  // The tutor works signed out; a session only keeps the conversation with the account.
  private async accountId(request: SessionRequest): Promise<string | undefined> {
    const account = await this.auth.current(sessionToken(request)).catch(() => undefined);
    return account?.accountId;
  }

  @Post(API_ROUTES.askTutor.path)
  @HttpCode(200)
  async ask(
    @Body(new ZodPipe(TutorTurnRequest, "Ask a question of a few words about this lesson."))
    body: z.output<typeof TutorTurnRequest>,
    @Ip() ip: string,
    @Req() request: SessionRequest,
  ): Promise<ApiResponse<"askTutor">> {
    return { exchange: await this.tutor.ask(body, ip, await this.accountId(request)) };
  }

  @Get(API_ROUTES.tutorConversation.path)
  async conversation(
    @Query(new ZodPipe(TutorConversationRequest, "Name the visit and the lesson."))
    query: z.output<typeof TutorConversationRequest>,
    @Req() request: SessionRequest,
  ): Promise<ApiResponse<"tutorConversation">> {
    return { exchanges: await this.tutor.conversation(query, await this.accountId(request)) };
  }

  @Post(API_ROUTES.resetTutorConversation.path)
  @HttpCode(200)
  async reset(
    @Body(new ZodPipe(TutorResetRequest, "Name the visit and the lesson to clear."))
    { sessionId, lessonId }: z.output<typeof TutorResetRequest>,
    @Req() request: SessionRequest,
  ): Promise<ApiResponse<"resetTutorConversation">> {
    return { deleted: await this.tutor.reset(sessionId, lessonId, await this.accountId(request)) };
  }
}
