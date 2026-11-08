import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  TutorConversationsRequest,
  TutorResetRequest,
  TutorTurnRequest,
  type ApiResponse,
} from "@sbi/contracts";
import type { z } from "zod";
import type { StoredAccount } from "@sbi/db";
import {
  SameOriginGuard,
  SessionGuard,
  SignedInAccount,
  sessionToken,
  type SessionRequest,
} from "../account/account.guard";
import { AuthService } from "../account/auth.service";
import { ClassAccess } from "../classes/class-access";
import { UserFacingException } from "../common/user-facing.exception";
import { ZodPipe } from "../common/zod.pipe";
import { TutorService } from "./tutor.service";

@Controller()
@UseGuards(SameOriginGuard)
export class TutorController {
  constructor(
    @Inject(TutorService) private readonly tutor: TutorService,
    @Inject(AuthService) private readonly auth: Pick<AuthService, "current">,
    @Inject(ClassAccess) private readonly classAccess: Pick<ClassAccess, "controls">,
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
    const controls = body.classCode ? await this.classAccess.controls(body.classCode) : undefined;
    if (controls && !controls.tutorEnabled) {
      throw new UserFacingException(
        "Your teacher has turned the tutor off for this class.",
        HttpStatus.FORBIDDEN,
      );
    }
    const asked = controls?.audienceLock ? { ...body, audience: controls.audienceLock } : body;
    return { exchange: await this.tutor.ask(asked, ip, await this.accountId(request)) };
  }

  @Get(API_ROUTES.tutorConversation.path)
  async conversation(
    @Query(new ZodPipe(TutorConversationRequest, "Name the visit and the lesson."))
    query: z.output<typeof TutorConversationRequest>,
    @Req() request: SessionRequest,
  ): Promise<ApiResponse<"tutorConversation">> {
    return { exchanges: await this.tutor.conversation(query, await this.accountId(request)) };
  }

  @Get(API_ROUTES.tutorConversations.path)
  @UseGuards(SessionGuard)
  async conversations(
    @SignedInAccount() account: StoredAccount,
    @Query(new ZodPipe(TutorConversationsRequest, "Name the page's language."))
    { locale }: z.output<typeof TutorConversationsRequest>,
  ): Promise<ApiResponse<"tutorConversations">> {
    return { conversations: await this.tutor.recentConversations(account.accountId, locale) };
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
