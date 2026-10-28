import { describe, expect, it } from "vitest";
import { expiryWithinLimit, parseUploadRequest } from "./request";

describe("parseUploadRequest", () => {
  it("accepts a well-formed intent", () => {
    expect(
      parseUploadRequest({ declaredType: "image/jpeg", filename: "leaf.jpg", sizeBytes: 100 }),
    ).toEqual({ declaredType: "image/jpeg", filename: "leaf.jpg", sizeBytes: 100 });
  });

  it("rejects malformed bodies", () => {
    expect(() => parseUploadRequest(null)).toThrow("Describe the photo");
    expect(() => parseUploadRequest({ declaredType: "image/jpeg" })).toThrow("Describe the photo");
    expect(() =>
      parseUploadRequest({ declaredType: "image/jpeg", filename: "a.jpg", sizeBytes: "100" }),
    ).toThrow("Describe the photo");
  });
});

describe("expiryWithinLimit", () => {
  it("bounds the presigned URL lifetime", () => {
    expect(expiryWithinLimit(300)).toBe(true);
    expect(expiryWithinLimit(0)).toBe(false);
    expect(expiryWithinLimit(901)).toBe(false);
  });
});
