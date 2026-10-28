import { EnvError } from "@sbi/env";
import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

const valid = {
  DATABASE_URL: "mysql://sbi:sbi@localhost:3306/sbi",
  S3_ENDPOINT: "http://localhost:8333",
  S3_REGION: "us-east-1",
  S3_BUCKET: "sbi-media",
  S3_ACCESS_KEY_ID: "sbi",
  S3_SECRET_ACCESS_KEY: "secret",
};

describe("loadEnv", () => {
  it("loads defaults and feature flags", () => {
    const env = loadEnv({ ...valid, FEATURE_FLAGS: "tutor" });

    expect(env.PORT).toBe(4000);
    expect(env.features).toEqual({ visualLab: false, tutor: true });
  });

  it("reads the purge schedule and retention TTLs", () => {
    const env = loadEnv({
      ...valid,
      MEDIA_PURGE_INTERVAL_MINUTES: "5",
      MEDIA_TTL_ORIGINAL_DAYS: "3",
    });

    expect(env.MEDIA_PURGE_INTERVAL_MINUTES).toBe(5);
    expect(env.retention.originalTtlDays).toBe(3);
    expect(env.retention.derivativeTtlDays).toBe(30);
  });

  it("fails fast when required variables are missing", () => {
    expect(() => loadEnv({})).toThrow(EnvError);
  });
});
