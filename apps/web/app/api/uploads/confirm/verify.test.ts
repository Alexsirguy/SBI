import { describe, expect, it } from "vitest";
import { assertOwnUploadKey, UploadClientError, verifyAndCleanse } from "./verify";

const KEY = "uploads/2026-01-15/1234-leaf.jpg";

function jpeg(extra: Uint8Array[] = []): Uint8Array {
  const sos = new Uint8Array([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]);
  const head = new Uint8Array([0xff, 0xd8]);
  const entropy = new Uint8Array([0xaa, 0xbb]);
  const end = new Uint8Array([0xff, 0xd9]);
  const parts = [head, ...extra, sos, entropy, end];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function commentSegment(comment: string): Uint8Array {
  const text = new TextEncoder().encode(comment);
  const segment = new Uint8Array(4 + text.length);
  segment[0] = 0xff;
  segment[1] = 0xfe;
  new DataView(segment.buffer).setUint16(2, text.length + 2);
  segment.set(text, 4);
  return segment;
}

describe("assertOwnUploadKey", () => {
  it("accepts server-issued keys and rejects the rest", () => {
    expect(assertOwnUploadKey(KEY)).toBe(KEY);
    for (const bad of ["../other/x.jpg", "/absolute.jpg", "uploads/evil.jpg", 42, undefined]) {
      expect(() => assertOwnUploadKey(bad)).toThrow(UploadClientError);
    }
  });
});

describe("verifyAndCleanse", () => {
  it("strips surviving metadata and reports the change", () => {
    const cleansed = verifyAndCleanse(jpeg([commentSegment("Device Pixel")]));
    expect(cleansed.contentType).toBe("image/jpeg");
    expect(cleansed.changed).toBe(true);
    expect(new TextDecoder("latin1").decode(cleansed.bytes)).not.toContain("Device Pixel");
  });

  it("leaves clean photos untouched", () => {
    const clean = jpeg();
    const cleansed = verifyAndCleanse(clean);
    expect(cleansed.changed).toBe(false);
    expect(cleansed.bytes).toBe(clean);
  });

  it("rejects non-photos and unscannable HEIC as client errors", () => {
    expect(() => verifyAndCleanse(new Uint8Array([0x47, 0x49, 0x46]))).toThrow(UploadClientError);
    const heic = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99]);
    expect(() => verifyAndCleanse(heic)).toThrow("JPEG or PNG");
  });
});
