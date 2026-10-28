import { z } from "zod";

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

export const KeepPhotoRequest = z.object({ key: PhotoKey });

export const KeptPhoto = z.object({ kept: z.literal(true) });

/** HTTP routes served by `apps/api`; the web client and OpenAPI document both read this table. */
export const API_ROUTES = {
  requestUpload: {
    method: "post",
    path: "/uploads",
    summary: "Issue a presigned upload URL and a confirm token for one photo.",
    request: UploadRequest,
    response: UploadTicket,
    errors: [400, 503],
  },
  confirmUpload: {
    method: "post",
    path: "/uploads/confirm",
    summary: "Scan, strip and store an uploaded photo under its private key.",
    request: ConfirmUploadRequest,
    response: ConfirmedPhoto,
    errors: [400, 502, 503],
  },
  keepPhoto: {
    method: "post",
    path: "/photos/keep",
    summary: "Exempt a stored photo from automatic deletion.",
    request: KeepPhotoRequest,
    response: KeptPhoto,
    errors: [400, 409, 502, 503],
  },
} as const;

export type ApiRouteName = keyof typeof API_ROUTES;
export type ApiRequest<N extends ApiRouteName> = z.input<(typeof API_ROUTES)[N]["request"]>;
export type ApiResponse<N extends ApiRouteName> = z.output<(typeof API_ROUTES)[N]["response"]>;
