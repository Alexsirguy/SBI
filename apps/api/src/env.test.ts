import { EnvError } from "@sbi/env";
import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

const valid = {
  DATABASE_URL: "postgres://sbi:sbi@localhost:5432/sbi",
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

  it("fails fast when required variables are missing", () => {
    expect(() => loadEnv({})).toThrow(EnvError);
  });
});
