import { createEnv, FEATURE_DEFAULTS, parseFlags } from "@sbi/env";
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_FEATURE_FLAGS: z.string().optional(),
});

// Next.js only inlines public variables that are referenced by name.
const env = createEnv(schema, {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_FEATURE_FLAGS: process.env.NEXT_PUBLIC_FEATURE_FLAGS,
});

export const webEnv = {
  apiUrl: env.NEXT_PUBLIC_API_URL,
  features: parseFlags(FEATURE_DEFAULTS, env.NEXT_PUBLIC_FEATURE_FLAGS),
};
