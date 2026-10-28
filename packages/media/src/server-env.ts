import { createEnv, type EnvSource } from "@sbi/env";
import { z } from "zod";
import type { ClamdConfig } from "./scanner";
import type { S3StorageConfig } from "./storage";

const schema = z.object({
  CLAMAV_HOST: z.string().min(1),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
  MEDIA_S3_ACCESS_KEY_ID: z.string().min(1),
  MEDIA_S3_BUCKET: z.string().min(1),
  MEDIA_S3_ENDPOINT: z.url(),
  MEDIA_S3_FORCE_PATH_STYLE: z.stringbool().default(false),
  MEDIA_S3_REGION: z.string().min(1).default("auto"),
  MEDIA_S3_SECRET_ACCESS_KEY: z.string().min(1),
  MEDIA_UPLOAD_ORIGINS: z.string().default(""),
  UPLOAD_TOKEN_SECRET: z.string().min(32),
});

export interface MediaServerEnv {
  storage: S3StorageConfig;
  clamd: ClamdConfig;
  uploadTokenSecret: string;
}

// Throws when anything is missing so upload routes fail closed rather than run unscanned.
export function readMediaServerEnv(source: EnvSource): MediaServerEnv {
  const env = createEnv(schema, source);
  return {
    clamd: { host: env.CLAMAV_HOST, port: env.CLAMAV_PORT },
    storage: {
      accessKeyId: env.MEDIA_S3_ACCESS_KEY_ID,
      bucket: env.MEDIA_S3_BUCKET,
      endpoint: env.MEDIA_S3_ENDPOINT,
      forcePathStyle: env.MEDIA_S3_FORCE_PATH_STYLE,
      region: env.MEDIA_S3_REGION,
      secretAccessKey: env.MEDIA_S3_SECRET_ACCESS_KEY,
      uploadOrigins: env.MEDIA_UPLOAD_ORIGINS.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    },
    uploadTokenSecret: env.UPLOAD_TOKEN_SECRET,
  };
}
