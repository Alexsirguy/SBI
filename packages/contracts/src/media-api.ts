import { z } from "zod";
import { ConsentVersion } from "./consent";

export const ApiError = z.object({ error: z.string().min(1) });

/** Stored photo keys are unguessable UUIDs, so holding one is the permission to act on it. */
export const PhotoKey = z.string().regex(/^photos\/[0-9a-f-]{36}\.(jpg|png)$/, "Unknown photo.");

export const UploadRequest = z.object({
  declaredType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

export const UploadTicket = z.object({
  uploadUrl: z.url(),
  token: z.string().min(1),
  expiresInSeconds: z.number().int().positive(),
});

export const ConfirmUploadRequest = z.object({ token: z.string().min(1) });

export const ConfirmedPhoto = z.object({
  key: PhotoKey,
  contentType: z.enum(["image/jpeg", "image/png"]),
});

/** Keeping a photo needs the learner's save-photos opt-in; its version is stored with the photo. */
export const KeepPhotoRequest = z.object({ key: PhotoKey, consentVersion: ConsentVersion });

export const KeptPhoto = z.object({ kept: z.literal(true) });

export const DeletePhotoRequest = z.object({ key: PhotoKey });

export const DeletedPhoto = z.object({ deleted: z.literal(true) });
