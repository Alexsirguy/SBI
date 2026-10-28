import { describe, expect, it } from "vitest";
import { contractOpenApi } from "./json-schema";
import {
  API_ROUTES,
  ConfirmedPhoto,
  KeepPhotoRequest,
  UploadRequest,
  UploadTicket,
} from "./media-api";

const key = "photos/0192f1a0-0000-7000-8000-000000000001.jpg";

describe("media API contracts", () => {
  it("accepts a well-formed upload round trip", () => {
    expect(UploadRequest.parse({ declaredType: "image/jpeg", sizeBytes: 1024 })).toBeTruthy();
    expect(
      UploadTicket.parse({ expiresInSeconds: 300, token: "t", uploadUrl: "https://r2.test/put" }),
    ).toBeTruthy();
    expect(ConfirmedPhoto.parse({ contentType: "image/jpeg", key })).toEqual({
      contentType: "image/jpeg",
      key,
    });
  });

  it("rejects keys outside the private photo prefix", () => {
    for (const bad of ["staging/x.jpg", "photos/../secret.jpg", `${key}.exe`]) {
      expect(KeepPhotoRequest.safeParse({ key: bad }).success).toBe(false);
    }
  });

  it("rejects empty or fractional upload sizes", () => {
    for (const sizeBytes of [0, -1, 1.5]) {
      expect(UploadRequest.safeParse({ declaredType: "image/jpeg", sizeBytes }).success).toBe(
        false,
      );
    }
  });

  it("documents every route in the OpenAPI paths", () => {
    const paths = contractOpenApi().paths as Record<string, Record<string, unknown>>;

    for (const route of Object.values(API_ROUTES)) {
      expect(paths[route.path]?.[route.method]).toMatchObject({ requestBody: { required: true } });
    }
  });
});
