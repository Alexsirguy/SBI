import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import type { ApiRequest, ApiResponse } from "@sbi/contracts";
import {
  confirmUpload,
  issueUploadToken,
  ScanUnavailableError,
  UploadRejectedError,
  validateUploadIntent,
  verifyUploadToken,
  type MalwareScanner,
  type MediaRegistry,
  type ObjectStorage,
  type RetentionPolicy,
  type UploadPolicy,
} from "@sbi/media";
import { UserFacingException } from "../common/user-facing.exception";
import type { ApiEnv } from "../env";
import {
  API_ENV,
  MALWARE_SCANNER,
  MEDIA_REGISTRY,
  OBJECT_STORAGE,
  RETENTION_POLICY,
  UPLOAD_POLICY,
} from "../tokens";

// Gives a slow connection time to finish the PUT before confirming.
const CONFIRM_GRACE_SECONDS = 600;
const UNKNOWN_UPLOAD = "Unknown upload. Start the upload again.";

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(MALWARE_SCANNER) private readonly scanner: MalwareScanner,
    @Inject(MEDIA_REGISTRY) private readonly registry: Pick<MediaRegistry, "register" | "keep">,
    @Inject(RETENTION_POLICY) private readonly retention: RetentionPolicy,
    @Inject(UPLOAD_POLICY) private readonly uploadPolicy: UploadPolicy,
    @Inject(API_ENV) private readonly env: Pick<ApiEnv, "UPLOAD_TOKEN_SECRET">,
  ) {}

  async requestUpload(intent: ApiRequest<"requestUpload">): Promise<ApiResponse<"requestUpload">> {
    // TODO(#120): rate-limit upload requests per client before signing URLs.
    let accepted;
    try {
      accepted = validateUploadIntent(intent, this.uploadPolicy);
    } catch (error) {
      throw new UserFacingException(messageOf(error), HttpStatus.BAD_REQUEST);
    }
    try {
      const uploadUrl = await this.storage.presignPut({
        contentLength: accepted.sizeBytes,
        contentType: accepted.contentType,
        expiresInSeconds: accepted.expiresInSeconds,
        key: accepted.stagingKey,
      });
      const expiresAt = new Date(
        Date.now() + (accepted.expiresInSeconds + CONFIRM_GRACE_SECONDS) * 1000,
      );
      const token = await issueUploadToken(
        this.env.UPLOAD_TOKEN_SECRET,
        accepted.stagingKey,
        expiresAt,
      );
      return { expiresInSeconds: accepted.expiresInSeconds, token, uploadUrl };
    } catch (error) {
      this.logger.error(`Presigning failed: ${messageOf(error)}`);
      throw new UserFacingException(
        "Photo uploads are unavailable right now.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async confirmUpload({
    token,
  }: ApiRequest<"confirmUpload">): Promise<ApiResponse<"confirmUpload">> {
    let stagingKey: string;
    try {
      stagingKey = await verifyUploadToken(this.env.UPLOAD_TOKEN_SECRET, token);
    } catch {
      throw new UserFacingException(UNKNOWN_UPLOAD, HttpStatus.BAD_REQUEST);
    }
    try {
      const confirmed = await confirmUpload({
        maxBytes: this.uploadPolicy.maxBytes,
        policy: this.retention,
        registry: this.registry,
        scanner: this.scanner,
        stagingKey,
        storage: this.storage,
      });
      // TODO(#34): once recognition succeeds, call registry.expireSooner with recognisedExpiry.
      return { contentType: confirmed.contentType, key: confirmed.key };
    } catch (error) {
      if (error instanceof UploadRejectedError) {
        throw new UserFacingException(error.message, HttpStatus.BAD_REQUEST);
      }
      if (error instanceof ScanUnavailableError) {
        throw new UserFacingException(error.message, HttpStatus.SERVICE_UNAVAILABLE);
      }
      this.logger.error(`Confirming failed: ${messageOf(error)}`);
      throw new UserFacingException("The photo could not be verified.", HttpStatus.BAD_GATEWAY);
    }
  }

  async keepPhoto({ key }: ApiRequest<"keepPhoto">): Promise<ApiResponse<"keepPhoto">> {
    let kept: boolean;
    try {
      kept = await this.registry.keep(key);
    } catch (error) {
      this.logger.error(`Keeping failed: ${messageOf(error)}`);
      throw new UserFacingException(
        "The photo could not be kept. Try again.",
        HttpStatus.BAD_GATEWAY,
      );
    }
    if (!kept) {
      throw new UserFacingException(
        "This photo has already been deleted and cannot be kept.",
        HttpStatus.CONFLICT,
      );
    }
    return { kept: true };
  }
}
