import type { UploadableImageType } from "./image-type";

export interface UploadPolicy {
  allowedTypes: UploadableImageType[];
  maxBytes: number;
  expiresInSeconds: number;
}

export interface UploadIntent {
  declaredType: string;
  sizeBytes: number;
}

export interface AcceptedUpload {
  stagingKey: string;
  contentType: UploadableImageType;
  sizeBytes: number;
  expiresInSeconds: number;
}

export const MAX_UPLOAD_EXPIRY_SECONDS = 900;

export const DEFAULT_UPLOAD_POLICY: UploadPolicy = {
  allowedTypes: ["image/jpeg", "image/png"],
  expiresInSeconds: 300,
  maxBytes: 10 * 1024 * 1024,
};

export const STAGING_PREFIX = "staging/";
export const PHOTO_PREFIX = "photos/";

const EXTENSIONS: Record<UploadableImageType, string> = { "image/jpeg": "jpg", "image/png": "png" };

// Keys carry no learner data, so filenames can never leak into storage or logs.
export function createObjectKey(
  prefix: string,
  type: UploadableImageType,
  randomId: string = crypto.randomUUID(),
): string {
  return `${prefix}${randomId}.${EXTENSIONS[type]}`;
}

// Declared type and size only shape the signed URL; stored bytes are verified on confirm.
export function validateUploadIntent(
  intent: UploadIntent,
  policy: UploadPolicy = DEFAULT_UPLOAD_POLICY,
): AcceptedUpload {
  const contentType = policy.allowedTypes.find((type) => type === intent.declaredType);
  if (!contentType) {
    throw new Error("Upload a JPG or PNG photo.");
  }
  if (
    !Number.isInteger(intent.sizeBytes) ||
    intent.sizeBytes <= 0 ||
    intent.sizeBytes > policy.maxBytes
  ) {
    throw new Error(`Photos must be between 1 byte and ${policy.maxBytes} bytes.`);
  }
  if (policy.expiresInSeconds < 1 || policy.expiresInSeconds > MAX_UPLOAD_EXPIRY_SECONDS) {
    throw new Error(`Upload windows must be at most ${MAX_UPLOAD_EXPIRY_SECONDS} seconds.`);
  }
  return {
    contentType,
    expiresInSeconds: policy.expiresInSeconds,
    sizeBytes: intent.sizeBytes,
    stagingKey: createObjectKey(STAGING_PREFIX, contentType),
  };
}
