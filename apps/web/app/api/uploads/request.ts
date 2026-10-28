import { MAX_PRESIGN_EXPIRY_SECONDS } from "@sbi/media";

export interface UploadRequestBody {
  declaredType: unknown;
  sizeBytes: unknown;
  filename: unknown;
}

// Rejects malformed intents before any storage credential is touched.
export function parseUploadRequest(body: unknown): {
  declaredType: string;
  sizeBytes: number;
  filename: string;
} {
  if (typeof body !== "object" || body === null) {
    throw new Error("Describe the photo to upload: type, size, and filename.");
  }
  const { declaredType, filename, sizeBytes } = body as UploadRequestBody;
  if (typeof declaredType !== "string" || typeof filename !== "string") {
    throw new Error("Describe the photo to upload: type, size, and filename.");
  }
  if (typeof sizeBytes !== "number") {
    throw new Error("Describe the photo to upload: type, size, and filename.");
  }
  return { declaredType, filename, sizeBytes };
}

export function expiryWithinLimit(seconds: number): boolean {
  return Number.isInteger(seconds) && seconds >= 1 && seconds <= MAX_PRESIGN_EXPIRY_SECONDS;
}
