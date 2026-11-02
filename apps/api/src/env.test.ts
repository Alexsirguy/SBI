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
  CLAMAV_HOST: "127.0.0.1",
  UPLOAD_TOKEN_SECRET: "x".repeat(32),
  WEB_ORIGINS: "http://localhost:3000, https://sbi.example",
};

describe("loadEnv", () => {
  it("loads defaults and feature flags", () => {
    const env = loadEnv({ ...valid, FEATURE_FLAGS: "tutor" });

    expect(env.PORT).toBe(4000);
    expect(env.features).toEqual({ photoRecognition: true, tutor: true, visualLab: false });
  });

  it("emails through ZeptoMail only when a token and sender are set", () => {
    expect(loadEnv(valid).mail).toBeNull();
    expect(
      loadEnv({ ...valid, ZEPTOMAIL_FROM: "hello@sbi.example", ZEPTOMAIL_TOKEN: "t" }).mail,
    ).toMatchObject({ from: "hello@sbi.example", token: "t" });
    expect(() => loadEnv({ ...valid, ZEPTOMAIL_TOKEN: "t" })).toThrow(/ZEPTOMAIL_FROM/);
  });

  it("marks the session cookie Secure in production unless told otherwise", () => {
    expect(loadEnv(valid).sessionCookieSecure).toBe(false);
    expect(loadEnv({ ...valid, NODE_ENV: "production" }).sessionCookieSecure).toBe(true);
    expect(loadEnv({ ...valid, SESSION_COOKIE_SECURE: "true" }).sessionCookieSecure).toBe(true);
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

  it("reads the scanner and the web origins allowed to call the API", () => {
    const env = loadEnv(valid);

    expect(env.CLAMAV_PORT).toBe(3310);
    expect(env.webOrigins).toEqual(["http://localhost:3000", "https://sbi.example"]);
  });

  it("refuses a short upload token secret", () => {
    expect(() => loadEnv({ ...valid, UPLOAD_TOKEN_SECRET: "short" })).toThrow(EnvError);
  });

  it("fails fast when required variables are missing", () => {
    expect(() => loadEnv({})).toThrow(EnvError);
  });

  it("keeps tutor turns for research no longer than a year", () => {
    expect(() => loadEnv({ ...valid, TUTOR_TTL_RESEARCH_DAYS: "400" })).toThrow(
      "TUTOR_TTL_RESEARCH_DAYS",
    );
  });
});
