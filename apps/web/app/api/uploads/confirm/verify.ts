import { sniffImageType, stripMetadata, type UploadableImageType } from "@sbi/media";

export interface CleansedPhoto {
  bytes: Uint8Array;
  changed: boolean;
  contentType: UploadableImageType;
}

// Client mistakes (400); anything else is a storage failure (502).
export class UploadClientError extends Error {}

const UPLOAD_KEY_PATTERN = /^uploads\/\d{4}-\d{2}-\d{2}\/[A-Za-z0-9._-]+$/;

// Keys are server-issued; anything else is a request for someone else's object.
export function assertOwnUploadKey(key: unknown): string {
  if (typeof key !== "string" || !UPLOAD_KEY_PATTERN.test(key)) {
    throw new UploadClientError("Unknown upload. Start the upload again.");
  }
  return key;
}

// Re-validates stored bytes, since the browser's word is not evidence.
export function verifyAndCleanse(stored: Uint8Array): CleansedPhoto {
  let contentType;
  try {
    contentType = sniffImageType(stored);
  } catch (error) {
    throw new UploadClientError(
      error instanceof Error ? error.message : "The stored object is not a supported photo.",
    );
  }
  if (contentType === "image/heic") {
    // No server-side HEIC scrubber exists yet, so processed uploads must be JPEG or PNG.
    throw new UploadClientError("Photos must finish processing as JPEG or PNG before upload.");
  }
  const stripped = stripMetadata(stored, contentType);
  const changed =
    stripped.length !== stored.length || stripped.some((byte, i) => byte !== stored[i]);
  return { bytes: changed ? stripped : stored, changed, contentType };
}
