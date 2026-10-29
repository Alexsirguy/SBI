import { describe, expect, it } from "vitest";
import { loadEnv } from "../env";
import { lessonProviderFor } from "./lesson.module";

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

describe("lessonProviderFor", () => {
  it("prefers the Meta key and needs a model", () => {
    expect(
      lessonProviderFor(loadEnv({ ...base, META_MODEL_API_KEY: "k", LESSON_MODEL: "m" }))?.id,
    ).toBe("lesson-meta");
    expect(
      lessonProviderFor(loadEnv({ ...base, META_MODEL_API_KEY: "k", OPENAI_API_KEY: "k" })),
    ).toBeNull();
  });

  it("falls back to the OpenAI key", () => {
    expect(
      lessonProviderFor(loadEnv({ ...base, OPENAI_API_KEY: "k", LESSON_MODEL: "m" }))?.id,
    ).toBe("lesson-openai");
  });

  it("stays off without keys", () => {
    expect(lessonProviderFor(loadEnv({ ...base, LESSON_MODEL: "m" }))).toBeNull();
  });
});
