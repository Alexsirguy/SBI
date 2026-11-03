import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Ip,
  Logger,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ACCOUNT_PHOTO_PATH,
  API_ROUTES,
  CONSENT_VERSION,
  DeleteAccountRequest,
  EmptyRequest,
  LinkAccountRequest,
  type ApiResponse,
} from "@sbi/contracts";
import type { AccountRepository, SavedLessonRepository, StoredAccount } from "@sbi/db";
import {
  deleteOnRequest,
  type DeletionAuditLog,
  type MediaRegistry,
  type ObjectStorage,
  type UploadPolicy,
} from "@sbi/media";
import type { z } from "zod";
import { UserFacingException } from "../common/user-facing.exception";
import { ZodPipe } from "../common/zod.pipe";
import {
  ACCOUNTS,
  DELETION_AUDIT,
  MEDIA_REGISTRY,
  OBJECT_STORAGE,
  SAVED_LESSONS,
  UPLOAD_POLICY,
} from "../tokens";
import {
  SameOriginGuard,
  SessionGuard,
  SignedInAccount,
  sessionToken,
  type SessionRequest,
} from "./account.guard";
import { AuthService, toAccount } from "./auth.service";

const DONE = { ok: true } as const;
const PHOTO_FILE = /^[0-9a-f-]{36}\.(jpg|png)$/;

/** The reply methods used here, so the app does not depend on Fastify's types directly. */
interface Reply {
  header(name: string, value: string): unknown;
}

// Said in the export, so the learner knows what exists elsewhere and why it is not in the file.
const EXPORT_NOTES = [
  "Lessons themselves hold no personal data, so only your list of saved lessons is included.",
  "Photos kept on a device but never linked to this account are listed on that device's privacy page.",
  "Recognition results, tutor turns and feedback are not tied to your account; they are deleted on the schedule in our retention policy.",
];

@Controller()
@UseGuards(SameOriginGuard, SessionGuard)
export class AccountController {
  private readonly logger = new Logger(AccountController.name);

  constructor(
    @Inject(ACCOUNTS) private readonly accounts: AccountRepository,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SAVED_LESSONS) private readonly saved: Pick<SavedLessonRepository, "list">,
    @Inject(OBJECT_STORAGE) private readonly storage: Pick<ObjectStorage, "read" | "remove">,
    @Inject(MEDIA_REGISTRY)
    private readonly registry: Pick<MediaRegistry, "release" | "claimForDeletion" | "forget">,
    @Inject(DELETION_AUDIT) private readonly audit: DeletionAuditLog,
    @Inject(UPLOAD_POLICY) private readonly uploads: Pick<UploadPolicy, "maxBytes">,
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

  @Get(API_ROUTES.exportAccount.path)
  async export(@SignedInAccount() account: StoredAccount): Promise<ApiResponse<"exportAccount">> {
    const [saved, photos] = await Promise.all([
      this.saved.list(account.accountId),
      this.accounts.ownedPhotos(account.accountId),
    ]);
    return {
      account: {
        ageAtSignup: account.ageAtSignup,
        consentVersion: account.consentVersion,
        createdAt: account.createdAt.toISOString(),
        email: account.email,
        emailVerified: account.emailVerifiedAt !== null,
        firstName: account.firstName,
        lastName: account.lastName,
        linkedAt: account.linkedAt?.toISOString() ?? null,
        signInMethods: [
          ...(account.passwordHash ? (["password"] as const) : []),
          ...(account.googleSub ? (["google"] as const) : []),
        ],
      },
      exportedAt: new Date().toISOString(),
      notes: EXPORT_NOTES,
      photos: photos.map((photo) => ({
        consentVersion: photo.consentVersion,
        download: `${ACCOUNT_PHOTO_PATH}/${photo.key.slice("photos/".length)}`,
        key: photo.key,
      })),
      savedLessons: saved.map((item) => ({
        lessonId: item.lessonId,
        savedAt: item.savedAt.toISOString(),
        title: item.title,
        version: item.version,
      })),
    };
  }

  // Bytes, not JSON, so this route sits outside API_ROUTES; ownership is checked every time.
  @Get(`${ACCOUNT_PHOTO_PATH}/:file`)
  async photo(
    @SignedInAccount() account: StoredAccount,
    @Param("file") file: string,
    @Res({ passthrough: true }) reply: Reply,
  ): Promise<Buffer> {
    const key = `photos/${file}`;
    const owned = PHOTO_FILE.test(file)
      ? (await this.accounts.ownedPhotos(account.accountId)).some((photo) => photo.key === key)
      : false;
    if (!owned)
      throw new UserFacingException("That photo is not in your account.", HttpStatus.NOT_FOUND);
    const bytes = await this.storage.read(key, this.uploads.maxBytes);
    reply.header("content-type", file.endsWith(".png") ? "image/png" : "image/jpeg");
    reply.header("content-disposition", `attachment; filename="${file}"`);
    return Buffer.from(bytes);
  }

  @Post(API_ROUTES.deleteAccount.path)
  @HttpCode(200)
  async delete(
    @SignedInAccount() account: StoredAccount,
    @Body(new ZodPipe(DeleteAccountRequest, "Type your email to confirm."))
    { email }: z.output<typeof DeleteAccountRequest>,
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) reply: Reply,
  ): Promise<ApiResponse<"deleteAccount">> {
    if (email !== account.email) {
      throw new UserFacingException(
        "That email does not match this account. Nothing was deleted.",
        HttpStatus.BAD_REQUEST,
      );
    }
    // Photos first: if storage fails, the account still exists to try again from.
    const photos = await this.accounts.ownedPhotos(account.accountId);
    try {
      for (const photo of photos) {
        await deleteOnRequest(
          { audit: this.audit, registry: this.registry, storage: this.storage },
          photo.key,
          new Date(),
        );
      }
    } catch (error) {
      this.logger.error(
        `Account photo deletion failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UserFacingException(
        "Your photos could not be deleted, so your account was kept. Try again.",
        HttpStatus.BAD_GATEWAY,
      );
    }
    await this.accounts.delete(account.accountId);
    reply.header("set-cookie", await this.auth.signOut(sessionToken(request)));
    return { deletedPhotos: photos.map((photo) => photo.key) };
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
