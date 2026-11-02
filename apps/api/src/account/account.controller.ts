import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Ip,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  API_ROUTES,
  CONSENT_VERSION,
  EmptyRequest,
  LinkAccountRequest,
  type ApiResponse,
} from "@sbi/contracts";
import type { AccountRepository, StoredAccount } from "@sbi/db";
import type { z } from "zod";
import { UserFacingException } from "../common/user-facing.exception";
import { ZodPipe } from "../common/zod.pipe";
import { ACCOUNTS } from "../tokens";
import { SameOriginGuard, SessionGuard, SignedInAccount } from "./account.guard";
import { AuthService, toAccount } from "./auth.service";

const DONE = { ok: true } as const;

@Controller()
@UseGuards(SameOriginGuard, SessionGuard)
export class AccountController {
  constructor(
    @Inject(ACCOUNTS) private readonly accounts: AccountRepository,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get(API_ROUTES.getAccount.path)
  get(@SignedInAccount() account: StoredAccount): ApiResponse<"getAccount"> {
    return toAccount(account);
  }

  @Post(API_ROUTES.resendVerification.path)
  @HttpCode(200)
  async resend(
    @SignedInAccount() account: StoredAccount,
    @Body(new ZodPipe(EmptyRequest, "This takes no options.")) _body: object,
    @Ip() ip: string,
  ): Promise<ApiResponse<"resendVerification">> {
    await this.auth.resendVerification(account, ip);
    return DONE;
  }

  @Post(API_ROUTES.linkAccount.path)
  @HttpCode(200)
  async link(
    @SignedInAccount() account: StoredAccount,
    @Body(new ZodPipe(LinkAccountRequest, "Say which photos to link, with your choice."))
    { consent, photoKeys }: z.output<typeof LinkAccountRequest>,
  ): Promise<ApiResponse<"linkAccount">> {
    // Consent given under older wording counts as not given (ADR 0019).
    if (consent.version !== CONSENT_VERSION || !consent.choices.account) {
      throw new UserFacingException(
        "Agree to linking this device to your account first.",
        HttpStatus.BAD_REQUEST,
      );
    }
    // An unproven email could belong to someone else, so nothing is tied to it yet.
    if (!account.emailVerifiedAt) {
      throw new UserFacingException(
        "Confirm your email address before linking this device.",
        HttpStatus.FORBIDDEN,
      );
    }
    const linkedPhotos = await this.accounts.link(
      account.accountId,
      [...new Set(photoKeys)],
      consent.version,
      new Date(),
    );
    return { accountId: account.accountId, linkedPhotos };
  }

  @Post(API_ROUTES.unlinkAccount.path)
  @HttpCode(200)
  async unlink(
    @SignedInAccount() account: StoredAccount,
    @Body(new ZodPipe(EmptyRequest, "Unlinking takes no options.")) _body: object,
  ): Promise<ApiResponse<"unlinkAccount">> {
    return { unlinkedPhotos: await this.accounts.unlink(account.accountId) };
  }
}
