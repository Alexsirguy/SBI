import { describe, expect, it } from "vitest";
import {
  ACCEPTED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  formatBytes,
  uploadLimitLabel,
  validateSelection,
} from "./limits";

describe("validateSelection", () => {
  it("accepts a known image type within the limit", () => {
    expect(validateSelection({ name: "a.png", size: 10, type: "image/png" })).toBeNull();
  });

  it("falls back to the extension when the browser reports no type", () => {
    expect(validateSelection({ name: "a.HEIC", size: 10, type: "" })).toBeNull();
    expect(validateSelection({ name: "a.heif", size: 10, type: "" })).toBeNull();
  });

  it("rejects files that are not photos", () => {
    expect(validateSelection({ name: "notes.txt", size: 10, type: "text/plain" })).toMatch(
      /is not a photo/,
    );
  });

  it("rejects empty files", () => {
    expect(validateSelection({ name: "a.jpg", size: 0, type: "image/jpeg" })).toMatch(/is empty/);
  });

  it("accepts exactly the maximum size and rejects one byte more", () => {
    const at = { name: "a.jpg", size: MAX_UPLOAD_BYTES, type: "image/jpeg" };
    expect(validateSelection(at)).toBeNull();
    expect(validateSelection({ ...at, size: MAX_UPLOAD_BYTES + 1 })).toMatch(
      new RegExp(`up to ${MAX_UPLOAD_LABEL}`),
    );
  });
});

describe("ACCEPTED_EXTENSIONS", () => {
  it("lists extensions and MIME types so pickers filter on every platform", () => {
    expect(ACCEPTED_EXTENSIONS.split(",")).toEqual(
      expect.arrayContaining([".heif", "image/jpeg", "image/heic"]),
    );
  });
});

describe("formatBytes", () => {
  it.each([
    [512, "512 B"],
    [2048, "2 KB"],
    [MAX_UPLOAD_BYTES, "10.0 MB"],
  ])("formats %d as %s", (bytes, label) => {
    expect(formatBytes(bytes)).toBe(label);
  });
});

describe("configurable upload limit", () => {
  it("applies a smaller configured limit and names it in the message", () => {
    const file = { name: "a.jpg", size: 3 * 1024 * 1024, type: "image/jpeg" };
    expect(validateSelection(file, 2 * 1024 * 1024)).toMatch(/up to 2 MB/);
    expect(uploadLimitLabel(2 * 1024 * 1024)).toBe("2 MB");
  });
});
