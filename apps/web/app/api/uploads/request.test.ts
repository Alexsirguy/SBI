import { describe, expect, it } from "vitest";
import { parseUploadRequest } from "./request";

describe("parseUploadRequest", () => {
  it("keeps only the type and size, so filenames never reach the server", () => {
    expect(
      parseUploadRequest({ declaredType: "image/jpeg", filename: "leaf.jpg", sizeBytes: 100 }),
    ).toEqual({ declaredType: "image/jpeg", sizeBytes: 100 });
  });

  it("rejects malformed bodies", () => {
    expect(() => parseUploadRequest(null)).toThrow("Describe the photo");
    expect(() => parseUploadRequest({ declaredType: "image/jpeg" })).toThrow("Describe the photo");
    expect(() => parseUploadRequest({ declaredType: "image/jpeg", sizeBytes: "100" })).toThrow(
      "Describe the photo",
    );
  });
});
