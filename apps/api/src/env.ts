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
  // Sources change slowly; a monthly re-check, a few at a time, stays polite to free public APIs.
  EVIDENCE_RECHECK_INTERVAL_MINUTES: z.coerce.number().int().positive().default(360),
  EVIDENCE_MAX_AGE_DAYS: z.coerce.number().int().positive().default(30),
  EVIDENCE_RECHECK_BATCH: z.coerce.number().int().positive().max(200).default(20),
  // Overrides the contact in the evidence crawler's User-Agent (default in @sbi/evidence).
  EVIDENCE_CONTACT: z.string().min(1).max(200).optional(),
  // ADR 0016: evidence gathering stops here and the lesson is drafted with what was verified.
  EVIDENCE_BUDGET_MS: z.coerce.number().int().positive().default(25_000),
  // Free text may hold personal details despite the form's hint, so it does not outlive triage.
  FEEDBACK_DETAILS_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  FEEDBACK_MAX_PER_HOUR: z.coerce.number().int().positive().default(20),
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
    // LessonModule builds the lesson provider only when a key and model are both set.
    lessonSource: {
      META_MODEL_API_KEY: source.META_MODEL_API_KEY,
      OPENAI_API_KEY: source.OPENAI_API_KEY,
      LESSON_MODEL: source.LESSON_MODEL,
    },
    recognitionRetention: parseRecognitionRetention(source),
    retention: parseRetentionPolicy(source),
    webOrigins: env.WEB_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}

export type ApiEnv = ReturnType<typeof loadEnv>;
