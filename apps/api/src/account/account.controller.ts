import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  API_ROUTES,
  CONSENT_VERSION,
  LinkAccountRequest,
  UnlinkAccountRequest,
  type ApiRequest,
  type ApiResponse,
} from "@sbi/contracts";
import type { AccountRepository, StoredAccount } from "@sbi/db";
import { UserFacingException } from "../common/user-facing.exception";
import { ZodPipe } from "../common/zod.pipe";
import { ACCOUNTS } from "../tokens";
import { AccountGuard, SignedIn } from "./account.guard";
import type { SignedInIdentity } from "./token-verifier";

function toAccount(account: StoredAccount): ApiResponse<"getAccount"> {
  return {
    accountId: account.accountId,
    createdAt: account.createdAt.toISOString(),
    linkedAt: account.linkedAt?.toISOString() ?? null,
  };
}

@Controller()
@UseGuards(AccountGuard)
export class AccountController {
  constructor(@Inject(ACCOUNTS) private readonly accounts: AccountRepository) {}

  private find({ issuer, subject }: SignedInIdentity) {
    return this.accounts.findOrCreate(issuer, subject, new Date());
  }

  @Get(API_ROUTES.getAccount.path)
  async get(@SignedIn() identity: SignedInIdentity): Promise<ApiResponse<"getAccount">> {
    return toAccount(await this.find(identity));
  }

  @Post(API_ROUTES.linkAccount.path)
  @HttpCode(200)
  async link(
    @SignedIn() identity: SignedInIdentity,
    @Body(new ZodPipe(LinkAccountRequest, "Say which photos to link, with your choice."))
    { consent, photoKeys }: ApiRequest<"linkAccount">,
  ): Promise<ApiResponse<"linkAccount">> {
    // Consent given under older wording counts as not given (ADR 0019).
    if (consent.version !== CONSENT_VERSION || !consent.choices.account) {
      throw new UserFacingException(
        "Agree to linking this device to your account first.",
        HttpStatus.BAD_REQUEST,
      );
    }
    const account = await this.find(identity);
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
    @SignedIn() identity: SignedInIdentity,
    @Body(new ZodPipe(UnlinkAccountRequest, "Unlinking takes no options."))
    _body: ApiRequest<"unlinkAccount">,
  ): Promise<ApiResponse<"unlinkAccount">> {
    const account = await this.find(identity);
    return { unlinkedPhotos: await this.accounts.unlink(account.accountId) };
  }
}
