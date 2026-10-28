import { describe, expect, it } from "vitest";
import { detectImageType } from "./image-type";
import { createObjectKey, STAGING_PREFIX, validateUploadIntent } from "./uploads";

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
  it("issues a short-lived staging key that carries no learner data", () => {
    const accepted = validateUploadIntent({ declaredType: "image/jpeg", sizeBytes: 1024 });
    expect(accepted.contentType).toBe("image/jpeg");
    expect(accepted.stagingKey).toMatch(/^staging\/[0-9a-f-]{36}\.jpg$/);
    expect(accepted.expiresInSeconds).toBe(300);
  });

  it("rejects HEIC, other types and out-of-range sizes", () => {
    expect(() => validateUploadIntent({ declaredType: "image/heic", sizeBytes: 10 })).toThrow(
      "JPG or PNG",
    );
    expect(() => validateUploadIntent({ declaredType: "image/gif", sizeBytes: 10 })).toThrow();
    expect(() =>
      validateUploadIntent({ declaredType: "image/png", sizeBytes: 100 * 1024 * 1024 }),
    ).toThrow("bytes");
    expect(() => validateUploadIntent({ declaredType: "image/png", sizeBytes: 0 })).toThrow(
      "bytes",
    );
  });

  it("refuses an upload window longer than fifteen minutes", () => {
    expect(() =>
      validateUploadIntent(
        { declaredType: "image/png", sizeBytes: 10 },
        { allowedTypes: ["image/png"], expiresInSeconds: 3600, maxBytes: 100 },
      ),
    ).toThrow("900 seconds");
  });
});

describe("createObjectKey", () => {
  it("builds keys from a random id and the verified type only", () => {
    expect(createObjectKey(STAGING_PREFIX, "image/png", "abc")).toBe("staging/abc.png");
  });
});
