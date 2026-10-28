import { describe, expect, it } from "vitest";
import { loadEnv } from "../env";
import { testEnv } from "../testing/test-app";
import { recogniserFor } from "./recognition.module";

const base = {
  CLAMAV_HOST: "127.0.0.1",
  DATABASE_URL: "mysql://sbi:sbi@localhost:3306/sbi",
  S3_ACCESS_KEY_ID: "sbi",
  S3_BUCKET: "sbi-media",
  S3_ENDPOINT: "http://localhost:8333",
  S3_REGION: "us-east-1",
  S3_SECRET_ACCESS_KEY: "secret",
  UPLOAD_TOKEN_SECRET: "s".repeat(32),
  WEB_ORIGINS: "http://localhost:3000",
};

describe("recogniserFor", () => {
  it("stays off by default even with a provider key", () => {
    expect(recogniserFor(loadEnv({ ...base, META_MODEL_API_KEY: "k" }))).toBeNull();
    expect(testEnv.features.photoRecognition).toBe(false);
  });

  it("stays off when the flag is on but no key is set", () => {
    expect(recogniserFor(loadEnv({ ...base, FEATURE_FLAGS: "photoRecognition" }))).toBeNull();
  });

  it("builds the provider chain when the flag and a key are set", () => {
    const recogniser = recogniserFor(
      loadEnv({ ...base, FEATURE_FLAGS: "photoRecognition", OPENAI_API_KEY: "k" }),
    );
    expect(recogniser?.id).toBe("openai-mini");
  });
});
