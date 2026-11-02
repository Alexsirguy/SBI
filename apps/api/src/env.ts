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
  // Background gathering (ADR 0016) never delays a lesson; this only bounds a stuck gather.
  EVIDENCE_BUDGET_MS: z.coerce.number().int().positive().default(120_000),
  // Free text may hold personal details despite the form's hint, so it does not outlive triage.
  FEEDBACK_DETAILS_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  // Tutor turns by retention class (docs/retention.md); research needs the learner's opt-in.
  TUTOR_TTL_SESSION_HOURS: z.coerce.number().int().positive().default(24),
  TUTOR_TTL_QUALITY_DAYS: z.coerce.number().int().positive().default(30),
  TUTOR_TTL_RESEARCH_DAYS: z.coerce.number().int().positive().max(365).default(365),
  // Packs older than the 30-day reuse window are never read again.
  EVIDENCE_PACK_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CATALOG_GAP_TTL_DAYS: z.coerce.number().int().positive().default(365),
  FEEDBACK_MAX_PER_HOUR: z.coerce.number().int().positive().default(20),
  QUESTIONS_MAX_PER_HOUR: z.coerce.number().int().positive().default(60),
  FEATURE_FLAGS: z.string().optional(),
  // Accounts stay off unless both are set (ADR 0020); the issuer is the provider's OIDC URL.
  AUTH_ISSUER: z.url().optional(),
  AUTH_AUDIENCE: z.string().min(1).optional(),
});

function parseAuth(env: { AUTH_ISSUER?: string; AUTH_AUDIENCE?: string }) {
  if (!env.AUTH_ISSUER && !env.AUTH_AUDIENCE) return null;
  if (!env.AUTH_ISSUER || !env.AUTH_AUDIENCE) {
    throw new Error("Set both AUTH_ISSUER and AUTH_AUDIENCE, or neither to turn accounts off.");
  }
  return { audience: env.AUTH_AUDIENCE, issuer: env.AUTH_ISSUER };
}

export function loadEnv(source: EnvSource = process.env) {
  const env = createEnv(schema, source);
  return {
    ...env,
    auth: parseAuth(env),
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
