import { describe, expect, it } from "vitest";
import { createS3Storage } from "./storage";

const storage = createS3Storage({
  accessKeyId: "AKIDEXAMPLE",
  bucket: "photos",
  endpoint: "https://example123.r2.cloudflarestorage.com",
  forcePathStyle: true,
  region: "auto",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  uploadOrigins: [],
});

describe("createS3Storage presignPut", () => {
  it("signs a short-lived PUT bound to the declared type and length", async () => {
    const url = new URL(
      await storage.presignPut({
        contentLength: 1234,
        contentType: "image/jpeg",
        expiresInSeconds: 300,
        key: "staging/abc.jpg",
      }),
    );
    expect(url.origin).toBe("https://example123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/photos/staging/abc.jpg");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual(
      expect.arrayContaining(["content-length", "content-type", "host"]),
    );
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });
});
