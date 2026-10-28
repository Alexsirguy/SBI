import { describe, expect, it } from "vitest";
import { DEFAULT_CAPTURE_LIMITS, parseCaptureLimits } from "./config";

describe("parseCaptureLimits", () => {
  it("uses the defaults when nothing is configured", () => {
    expect(parseCaptureLimits({})).toEqual(DEFAULT_CAPTURE_LIMITS);
  });

  it("reads overrides from public env", () => {
    expect(
      parseCaptureLimits({
        NEXT_PUBLIC_CAPTURE_JPEG_QUALITY: "0.7",
        NEXT_PUBLIC_CAPTURE_MAX_DIMENSION: "2048",
        NEXT_PUBLIC_CAPTURE_MAX_UPLOAD_MB: "5",
      }),
    ).toEqual({ maxDimension: 2048, maxUploadBytes: 5 * 1024 * 1024, quality: 0.7 });
  });

  it("rejects values outside the safe range", () => {
    expect(() => parseCaptureLimits({ NEXT_PUBLIC_CAPTURE_JPEG_QUALITY: "2" })).toThrow(
      /NEXT_PUBLIC_CAPTURE_JPEG_QUALITY/,
    );
  });
});
