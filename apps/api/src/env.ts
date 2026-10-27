import { createEnv, FEATURE_DEFAULTS, parseFlags, type EnvSource } from "@sbi/env";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  FEATURE_FLAGS: z.string().optional(),
});

export function loadEnv(source: EnvSource = process.env) {
  const env = createEnv(schema, source);
  return { ...env, features: parseFlags(FEATURE_DEFAULTS, env.FEATURE_FLAGS) };
}

export type ApiEnv = ReturnType<typeof loadEnv>;
