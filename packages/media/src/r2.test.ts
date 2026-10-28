import { describe, expect, it } from "vitest";
import {
  createCanonicalRequest,
  createStringToSign,
  deriveSigningKey,
  hmac,
  MAX_PRESIGN_EXPIRY_SECONDS,
  presignR2Url,
  type R2Credentials,
} from "./r2";

const CREDENTIALS: R2Credentials = {
  accessKeyId: "AKIDEXAMPLE",
  accountId: "example123",
  bucket: "photos",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
};

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("SigV4 core", () => {
  // AWS get-vanilla vector, cross-checked against an independent implementation.
  it("matches the get-vanilla signature", async () => {
    const canonicalRequest = createCanonicalRequest({
      headers: { host: "host.foo.com", "x-amz-date": "20150830T123600Z" },
      method: "GET",
      path: "/",
      payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      query: { Param1: "value1" },
    });
    expect(canonicalRequest).toBe(
      [
        "GET",
        "/",
        "Param1=value1",
        "host:host.foo.com",
        "x-amz-date:20150830T123600Z",
        "",
        "host;x-amz-date",
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      ].join("\n"),
    );
    const stringToSign = await createStringToSign(
      canonicalRequest,
      "20150830T123600Z",
      "20150830",
      "us-east-1",
      "service",
    );
    const signingKey = await deriveSigningKey(
      "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      "20150830",
      "us-east-1",
      "service",
    );
    expect(hex(await hmac(signingKey, stringToSign))).toBe(
      "719013dc5b0fdd94c5c3bb44930a1318abd988e356f8a1df9948f1f1aeafe7c9",
    );
  });
});

describe("presignR2Url", () => {
  const now = new Date("2026-01-15T10:00:00.000Z");

  it("mints a scoped, expiring PUT URL on the R2 endpoint", async () => {
    const url = new URL(
      await presignR2Url(CREDENTIALS, {
        expiresInSeconds: 300,
        key: "uploads/2026-01-15/id-photo.jpg",
        method: "PUT",
        now,
      }),
    );
    expect(url.origin).toBe("https://example123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/photos/uploads/2026-01-15/id-photo.jpg");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Credential")).toBe(
      "AKIDEXAMPLE/20260115/auto/s3/aws4_request",
    );
    expect(url.searchParams.get("X-Amz-Date")).toBe("20260115T100000Z");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same inputs and separates methods", async () => {
    const input = { expiresInSeconds: 300, key: "uploads/a.jpg", method: "PUT" as const, now };
    expect(await presignR2Url(CREDENTIALS, input)).toBe(await presignR2Url(CREDENTIALS, input));
    const get = await presignR2Url(CREDENTIALS, { ...input, method: "GET" });
    expect(get).not.toBe(await presignR2Url(CREDENTIALS, input));
  });

  it("rejects long expiries and unsafe keys", async () => {
    await expect(
      presignR2Url(CREDENTIALS, {
        expiresInSeconds: MAX_PRESIGN_EXPIRY_SECONDS + 1,
        key: "uploads/a.jpg",
        method: "PUT",
      }),
    ).rejects.toThrow("Expiry");
    await expect(
      presignR2Url(CREDENTIALS, { expiresInSeconds: 60, key: "../escape.jpg", method: "PUT" }),
    ).rejects.toThrow("Invalid object key");
  });
});
