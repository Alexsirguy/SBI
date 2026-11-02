import { createEnv, FEATURE_DEFAULTS, parseFlags } from "@sbi/env";
import { z } from "zod";
import { parseCaptureLimits } from "./app/capture/config";

const schema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_FEATURE_FLAGS: z.string().optional(),
  NEXT_PUBLIC_AUTH_DOMAIN: z.string().min(1).optional(),
  NEXT_PUBLIC_AUTH_CLIENT_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_AUTH_AUDIENCE: z.string().min(1).optional(),
});

// Next.js only inlines public variables that are referenced by name.
const env = createEnv(schema, {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_FEATURE_FLAGS: process.env.NEXT_PUBLIC_FEATURE_FLAGS,
  NEXT_PUBLIC_AUTH_DOMAIN: process.env.NEXT_PUBLIC_AUTH_DOMAIN,
  NEXT_PUBLIC_AUTH_CLIENT_ID: process.env.NEXT_PUBLIC_AUTH_CLIENT_ID,
  NEXT_PUBLIC_AUTH_AUDIENCE: process.env.NEXT_PUBLIC_AUTH_AUDIENCE,
});

// Accounts are optional (ADR 0020): without all three, nothing about them is shown.
const auth =
  env.NEXT_PUBLIC_AUTH_DOMAIN && env.NEXT_PUBLIC_AUTH_CLIENT_ID && env.NEXT_PUBLIC_AUTH_AUDIENCE
    ? {
        audience: env.NEXT_PUBLIC_AUTH_AUDIENCE,
        clientId: env.NEXT_PUBLIC_AUTH_CLIENT_ID,
        domain: env.NEXT_PUBLIC_AUTH_DOMAIN,
      }
    : null;

export const webEnv = {
  apiUrl: env.NEXT_PUBLIC_API_URL,
  auth,
  features: parseFlags(FEATURE_DEFAULTS, env.NEXT_PUBLIC_FEATURE_FLAGS),
  capture: parseCaptureLimits({
    NEXT_PUBLIC_CAPTURE_JPEG_QUALITY: process.env.NEXT_PUBLIC_CAPTURE_JPEG_QUALITY,
    NEXT_PUBLIC_CAPTURE_MAX_DIMENSION: process.env.NEXT_PUBLIC_CAPTURE_MAX_DIMENSION,
    NEXT_PUBLIC_CAPTURE_MAX_UPLOAD_MB: process.env.NEXT_PUBLIC_CAPTURE_MAX_UPLOAD_MB,
  }),
};
