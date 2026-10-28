import { describe, expect, it } from "vitest";
import { issueUploadToken, verifyUploadToken } from "./upload-token";

const SECRET = "a-test-secret-that-is-at-least-32-chars";
const KEY = "staging/abc.jpg";

describe("upload tokens", () => {
  it("round-trips the staging key before expiry", async () => {
    const token = await issueUploadToken(SECRET, KEY, new Date(Date.now() + 60_000));
    await expect(verifyUploadToken(SECRET, token)).resolves.toBe(KEY);
  });

  it("rejects tampered, foreign, expired and malformed tokens", async () => {
    const token = await issueUploadToken(SECRET, KEY, new Date(Date.now() + 60_000));
    const [, signature] = token.split(".");
    const forged = `${btoa(`staging/other.jpg|${Date.now() + 60_000}`)}.${signature}`;
    await expect(verifyUploadToken(SECRET, forged)).rejects.toThrow("Unknown upload");
    await expect(verifyUploadToken(`${SECRET}-other`, token)).rejects.toThrow("Unknown upload");
    const expired = await issueUploadToken(SECRET, KEY, new Date(Date.now() - 1));
    await expect(verifyUploadToken(SECRET, expired)).rejects.toThrow("Unknown upload");
    await expect(verifyUploadToken(SECRET, "%%%.%%%")).rejects.toThrow("Unknown upload");
    await expect(verifyUploadToken(SECRET, 42)).rejects.toThrow("Unknown upload");
  });

  it("only vouches for staging keys", async () => {
    const token = await issueUploadToken(SECRET, "photos/abc.jpg", new Date(Date.now() + 60_000));
    await expect(verifyUploadToken(SECRET, token)).rejects.toThrow("Unknown upload");
  });
});
