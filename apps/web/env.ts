import { createEnv, FEATURE_DEFAULTS, parseFlags } from "@sbi/env";
import { z } from "zod";
import { parseCaptureLimits } from "./app/capture/config";

const schema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_FEATURE_FLAGS: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_MIXPANEL_TOKEN: z.string().min(1).optional(),
});

// Next.js only inlines public variables that are referenced by name.
const env = createEnv(schema, {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_FEATURE_FLAGS: process.env.NEXT_PUBLIC_FEATURE_FLAGS,
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  NEXT_PUBLIC_MIXPANEL_TOKEN: process.env.NEXT_PUBLIC_MIXPANEL_TOKEN,
});

export const webEnv = {
  apiUrl: env.NEXT_PUBLIC_API_URL,
  // Google's sign-in button shows only when its client id is set (ADR 0020).
  googleClientId: env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? null,
  // Usage statistics go nowhere until a Mixpanel project token is set (ADR 0026).
  mixpanelToken: env.NEXT_PUBLIC_MIXPANEL_TOKEN ?? null,
  features: parseFlags(FEATURE_DEFAULTS, env.NEXT_PUBLIC_FEATURE_FLAGS),
  capture: parseCaptureLimits({
    NEXT_PUBLIC_CAPTURE_JPEG_QUALITY: process.env.NEXT_PUBLIC_CAPTURE_JPEG_QUALITY,
    NEXT_PUBLIC_CAPTURE_MAX_DIMENSION: process.env.NEXT_PUBLIC_CAPTURE_MAX_DIMENSION,
    NEXT_PUBLIC_CAPTURE_MAX_UPLOAD_MB: process.env.NEXT_PUBLIC_CAPTURE_MAX_UPLOAD_MB,
  }),
};
