import { Body, Controller, HttpCode, Inject, Ip, Post, Req, Res, UseGuards } from "@nestjs/common";
import {
  API_ROUTES,
  EmptyRequest,
  FinishGoogleSignUpRequest,
  ForgotPasswordRequest,
  GoogleSignInRequest,
  ResetPasswordRequest,
  SignInRequest,
  SignUpRequest,
  VerifyEmailRequest,
  type ApiResponse,
} from "@sbi/contracts";
import type { z } from "zod";
import { ZodPipe } from "../common/zod.pipe";
import { SameOriginGuard, sessionToken, type SessionRequest } from "./account.guard";
import { AuthService } from "./auth.service";

const DONE = { ok: true } as const;

/** The one reply method used here, so the app does not depend on Fastify's types directly. */
interface Reply {
  header(name: string, value: string): unknown;
}

@Controller()
@UseGuards(SameOriginGuard)
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post(API_ROUTES.signUp.path)
  @HttpCode(200)
  async signUp(
    @Body(new ZodPipe(SignUpRequest, "Fill in every field to make an account."))
    body: z.output<typeof SignUpRequest>,
    @Ip() ip: string,
    @Res({ passthrough: true }) reply: Reply,
  ): Promise<ApiResponse<"signUp">> {
    const { account, cookie } = await this.auth.signUp(body, ip);
    reply.header("set-cookie", cookie);
    return account;
  }

  @Post(API_ROUTES.signIn.path)
  @HttpCode(200)
  async signIn(
    @Body(new ZodPipe(SignInRequest, "Enter your email and password."))
    body: z.output<typeof SignInRequest>,
    @Ip() ip: string,
    @Res({ passthrough: true }) reply: Reply,
  ): Promise<ApiResponse<"signIn">> {
    const { account, cookie } = await this.auth.signIn(body, ip);
    reply.header("set-cookie", cookie);
    return account;
  }

  @Post(API_ROUTES.signOut.path)
  @HttpCode(200)
  async signOut(
    @Body(new ZodPipe(EmptyRequest, "Signing out takes no options.")) _body: object,
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) reply: Reply,
  ): Promise<ApiResponse<"signOut">> {
    reply.header("set-cookie", await this.auth.signOut(sessionToken(request)));
    return DONE;
  }

  @Post(API_ROUTES.googleSignIn.path)
  @HttpCode(200)
  async googleSignIn(
    @Body(new ZodPipe(GoogleSignInRequest, "Google sign-in did not work. Try again."))
    { credential }: z.output<typeof GoogleSignInRequest>,
    @Res({ passthrough: true }) reply: Reply,
  ): Promise<ApiResponse<"googleSignIn">> {
    const result = await this.auth.googleSignIn(credential);
    if ("needs" in result) return result.needs;
    reply.header("set-cookie", result.signedIn.cookie);
    return { status: "signed-in" };
  }

  @Post(API_ROUTES.finishGoogleSignUp.path)
  @HttpCode(200)
  async finishGoogleSignUp(
    @Body(new ZodPipe(FinishGoogleSignUpRequest, "Fill in your name and age."))
    body: z.output<typeof FinishGoogleSignUpRequest>,
    @Res({ passthrough: true }) reply: Reply,
  ): Promise<ApiResponse<"finishGoogleSignUp">> {
    const { account, cookie } = await this.auth.finishGoogleSignUp(body);
    reply.header("set-cookie", cookie);
    return account;
  }

  @Post(API_ROUTES.verifyEmail.path)
  @HttpCode(200)
  async verifyEmail(
    @Body(new ZodPipe(VerifyEmailRequest, "This link is not valid."))
    { token }: z.output<typeof VerifyEmailRequest>,
  ): Promise<ApiResponse<"verifyEmail">> {
    await this.auth.verifyEmail(token);
    return DONE;
  }

  @Post(API_ROUTES.requestPasswordReset.path)
  @HttpCode(200)
  async forgot(
    @Body(new ZodPipe(ForgotPasswordRequest, "Enter a valid email address."))
    { email }: z.output<typeof ForgotPasswordRequest>,
    @Ip() ip: string,
  ): Promise<ApiResponse<"requestPasswordReset">> {
    await this.auth.requestPasswordReset(email, ip);
    return DONE;
  }

  @Post(API_ROUTES.resetPassword.path)
  @HttpCode(200)
  async reset(
    @Body(new ZodPipe(ResetPasswordRequest, "Choose a password of at least 10 characters."))
    body: z.output<typeof ResetPasswordRequest>,
  ): Promise<ApiResponse<"resetPassword">> {
    await this.auth.resetPassword(body);
    return DONE;
  }
}
