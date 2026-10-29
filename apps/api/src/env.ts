import { createEnv, FEATURE_DEFAULTS, parseFlags, type EnvSource } from "@sbi/env";
import { parseRetentionPolicy } from "@sbi/media";
import { parseRankingConfig, parseRecognitionRetention } from "@sbi/recognition";
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
  S3_FORCE_PATH_STYLE: z.stringbool().default(false),
  CLAMAV_HOST: z.string().min(1),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
  UPLOAD_TOKEN_SECRET: z.string().min(32),
  WEB_ORIGINS: z.string().min(1),
  MEDIA_PURGE_INTERVAL_MINUTES: z.coerce.number().int().positive().default(15),
  FEATURE_FLAGS: z.string().optional(),
});

export function loadEnv(source: EnvSource = process.env) {
  const env = createEnv(schema, source);
  return {
    ...env,
    features: parseFlags(FEATURE_DEFAULTS, env.FEATURE_FLAGS),
    ranking: parseRankingConfig(source),
    // Provider keys stay in the source; RecognitionModule builds the chain only when one is set.
    recognitionSource: {
      META_MODEL_API_KEY: source.META_MODEL_API_KEY,
      OPENAI_API_KEY: source.OPENAI_API_KEY,
      RECOGNITION_PROVIDERS: source.RECOGNITION_PROVIDERS,
      RECOGNITION_TIMEOUT_MS: source.RECOGNITION_TIMEOUT_MS,
    },
    recognitionRetention: parseRecognitionRetention(source),
    retention: parseRetentionPolicy(source),
    webOrigins: env.WEB_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}

export type ApiEnv = ReturnType<typeof loadEnv>;
