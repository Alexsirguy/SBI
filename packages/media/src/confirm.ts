import { sanitiseImage } from "./exif";
import { detectImageType, type UploadableImageType } from "./image-type";
import type { MalwareScanner } from "./scanner";
import { ObjectMissingError, ObjectTooLargeError, type ObjectStorage } from "./storage";
import { createObjectKey, PHOTO_PREFIX } from "./uploads";

export interface ConfirmedUpload {
  key: string;
  contentType: UploadableImageType;
}

// The learner can fix these by uploading again, so they map to a 400.
export class UploadRejectedError extends Error {}

// Fail closed: without a verdict the photo is refused, but the learner may retry later.
export class ScanUnavailableError extends Error {}

export interface ConfirmUploadInput {
  storage: ObjectStorage;
  scanner: MalwareScanner;
  stagingKey: string;
  maxBytes: number;
}

async function readStaged(storage: ObjectStorage, key: string, maxBytes: number) {
  try {
    return await storage.read(key, maxBytes);
  } catch (error) {
    if (error instanceof ObjectMissingError) {
      throw new UploadRejectedError("The photo did not arrive. Upload it again.");
    }
    if (error instanceof ObjectTooLargeError) {
      throw new UploadRejectedError("The photo is larger than allowed.");
    }
    throw error;
  }
}

async function verify(input: ConfirmUploadInput, bytes: Uint8Array): Promise<ConfirmedUpload> {
  const detected = detectImageType(bytes);
  if (detected === "image/heic") {
    throw new UploadRejectedError("Photos must be converted to JPEG or PNG before upload.");
  }
  if (!detected) {
    throw new UploadRejectedError("The uploaded file is not a supported photo.");
  }
  const verdict = await input.scanner.scan(bytes);
  if (verdict.status === "infected") {
    throw new UploadRejectedError("This file could not be accepted.");
  }
  if (verdict.status === "error") {
    throw new ScanUnavailableError("Photos cannot be checked right now. Try again shortly.");
  }
  let sanitised;
  try {
    sanitised = sanitiseImage(bytes);
  } catch {
    throw new UploadRejectedError("The photo is damaged. Take or choose it again.");
  }
  const key = createObjectKey(PHOTO_PREFIX, sanitised.type);
  await input.storage.write(key, sanitised.bytes, sanitised.type);
  return { contentType: sanitised.type, key };
}

// Only verified, re-stripped bytes reach a key clients cannot write; staging is always cleared.
export async function confirmUpload(input: ConfirmUploadInput): Promise<ConfirmedUpload> {
  try {
    const bytes = await readStaged(input.storage, input.stagingKey, input.maxBytes);
    return await verify(input, bytes);
  } finally {
    await input.storage.remove([input.stagingKey]);
  }
}
