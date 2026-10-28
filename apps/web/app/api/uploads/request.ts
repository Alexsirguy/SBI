import type { UploadIntent } from "@sbi/media";

const MALFORMED = "Describe the photo to upload: type and size.";

// Rejects malformed intents before any storage credential is touched.
export function parseUploadRequest(body: unknown): UploadIntent {
  if (typeof body !== "object" || body === null) {
    throw new Error(MALFORMED);
  }
  const { declaredType, sizeBytes } = body as Record<string, unknown>;
  if (typeof declaredType !== "string" || typeof sizeBytes !== "number") {
    throw new Error(MALFORMED);
  }
  return { declaredType, sizeBytes };
}
