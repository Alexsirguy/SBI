import { createEnv, type EnvSource } from "@sbi/env";
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_CAPTURE_JPEG_QUALITY: z.coerce.number().min(0.5).max(1).default(0.85),
  NEXT_PUBLIC_CAPTURE_MAX_DIMENSION: z.coerce.number().int().min(320).max(4096).default(1600),
  NEXT_PUBLIC_CAPTURE_MAX_UPLOAD_MB: z.coerce.number().positive().max(25).default(10),
});

export interface CaptureLimits {
  maxDimension: number;
  maxUploadBytes: number;
  quality: number;
}

export function parseCaptureLimits(source: EnvSource): CaptureLimits {
  const env = createEnv(schema, source);
  return {
    maxDimension: env.NEXT_PUBLIC_CAPTURE_MAX_DIMENSION,
    maxUploadBytes: env.NEXT_PUBLIC_CAPTURE_MAX_UPLOAD_MB * 1024 * 1024,
    quality: env.NEXT_PUBLIC_CAPTURE_JPEG_QUALITY,
  };
}

export const DEFAULT_CAPTURE_LIMITS: CaptureLimits = parseCaptureLimits({});
