import { describe, expect, it } from "vitest";
import { detectImageType } from "./image-type";
import {
  createObjectKey,
  loggingMalwareScanHook,
  readR2Env,
  sniffImageType,
  validateUploadIntent,
} from "./uploads";

describe("detectImageType", () => {
  it("recognises JPEG, PNG, and HEIC magic bytes", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]))).toBe("image/png");
    const heic = new Uint8Array(12);
    heic.set([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99]);
    expect(detectImageType(heic)).toBe("image/heic");
  });

  it("returns null for anything else", () => {
    expect(detectImageType(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull();
    expect(detectImageType(new Uint8Array([1, 2]))).toBeNull();
  });
});

describe("validateUploadIntent", () => {
  it("accepts a supported declaration and issues a server-side key", () => {
    const accepted = validateUploadIntent({
      declaredType: "image/jpeg",
      filename: "leaf.jpg",
      sizeBytes: 1024,
    });
    expect(accepted.contentType).toBe("image/jpeg");
    expect(accepted.key).toMatch(/^uploads\/\d{4}-\d{2}-\d{2}\/.+-leaf\.jpg$/);
    expect(accepted.expiresInSeconds).toBeLessThanOrEqual(900);
  });

  it("rejects unsupported types and oversized uploads", () => {
    expect(() =>
      validateUploadIntent({ declaredType: "image/gif", filename: "a.gif", sizeBytes: 10 }),
    ).toThrow("accept");
    expect(() =>
      validateUploadIntent({
        declaredType: "image/png",
        filename: "a.png",
        sizeBytes: 100 * 1024 * 1024,
      }),
    ).toThrow("bytes");
    expect(() =>
      validateUploadIntent({ declaredType: "image/png", filename: "a.png", sizeBytes: 0 }),
    ).toThrow("bytes");
  });
});

describe("createObjectKey", () => {
  it("neutralises directory traversal and odd characters", () => {
    expect(createObjectKey("uploads", "../../etc/passwd", "id")).toMatch(
      /^uploads\/\d{4}-\d{2}-\d{2}\/id-passwd$/,
    );
    expect(createObjectKey("uploads", "my photo (1).PNG", "id")).toMatch(/my_photo_1_.PNG$/);
  });
});

describe("readR2Env", () => {
  it("fails closed when storage is unconfigured", () => {
    expect(() => readR2Env({})).toThrow("not configured");
    expect(
      readR2Env({
        R2_ACCESS_KEY_ID: "a",
        R2_ACCOUNT_ID: "b",
        R2_BUCKET: "c",
        R2_SECRET_ACCESS_KEY: "d",
      }),
    ).toEqual({ accessKeyId: "a", accountId: "b", bucket: "c", secretAccessKey: "d" });
  });
});

describe("malware scan hook", () => {
  it("records scan requests for the external scanner", async () => {
    const messages: string[] = [];
    await loggingMalwareScanHook((message) => messages.push(message)).requestScan("uploads/a.jpg");
    expect(messages).toEqual(["Malware scan requested for uploads/a.jpg."]);
  });
});

describe("sniffImageType", () => {
  it("throws when stored bytes are not a photo", () => {
    expect(() => sniffImageType(new Uint8Array([0x47, 0x49, 0x46]))).toThrow(
      "not a supported photo",
    );
  });
});
