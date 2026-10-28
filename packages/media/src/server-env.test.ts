import { describe, expect, it } from "vitest";
import { readMediaServerEnv } from "./server-env";

const COMPLETE = {
  CLAMAV_HOST: "127.0.0.1",
  MEDIA_S3_ACCESS_KEY_ID: "sbi",
  MEDIA_S3_BUCKET: "sbi-photos",
  MEDIA_S3_ENDPOINT: "http://127.0.0.1:8333",
  MEDIA_S3_FORCE_PATH_STYLE: "true",
  MEDIA_S3_SECRET_ACCESS_KEY: "sbi-local-secret",
  UPLOAD_TOKEN_SECRET: "x".repeat(32),
};

describe("readMediaServerEnv", () => {
  it("reads storage, scanner and token settings with defaults", () => {
    expect(readMediaServerEnv(COMPLETE)).toEqual({
      clamd: { host: "127.0.0.1", port: 3310 },
      storage: {
        accessKeyId: "sbi",
        bucket: "sbi-photos",
        endpoint: "http://127.0.0.1:8333",
        forcePathStyle: true,
        region: "auto",
        secretAccessKey: "sbi-local-secret",
        uploadOrigins: [],
      },
      uploadTokenSecret: "x".repeat(32),
    });
  });

  it("parses the comma-separated upload origins", () => {
    const env = readMediaServerEnv({
      ...COMPLETE,
      MEDIA_UPLOAD_ORIGINS: "https://sbi.example, http://localhost:3000",
    });
    expect(env.storage.uploadOrigins).toEqual(["https://sbi.example", "http://localhost:3000"]);
  });

  it("fails closed when the scanner or storage is not configured", () => {
    expect(() => readMediaServerEnv({ ...COMPLETE, CLAMAV_HOST: undefined })).toThrow(
      "CLAMAV_HOST",
    );
    expect(() => readMediaServerEnv({ ...COMPLETE, UPLOAD_TOKEN_SECRET: "short" })).toThrow(
      "UPLOAD_TOKEN_SECRET",
    );
  });
});
