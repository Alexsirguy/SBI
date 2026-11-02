import { describe, expect, it } from "vitest";
import { TEST_SCRYPT } from "../testing/test-auth";
import { hashPassword, verifyPassword, weakPasswordReason } from "./passwords";

describe("passwords", () => {
  it("hashes with a fresh salt and verifies only the same password", async () => {
    const first = await hashPassword("correct horse battery", TEST_SCRYPT);
    const second = await hashPassword("correct horse battery", TEST_SCRYPT);

    expect(first).toMatch(/^scrypt\$1024\$8\$1\$/);
    expect(first).not.toBe(second);
    expect(await verifyPassword("correct horse battery", first)).toBe(true);
    expect(await verifyPassword("correct horse batter", first)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("refuses common passwords and ones built from the email", () => {
    expect(weakPasswordReason("Password123", "a@example.com")).toMatch(/too common/);
    expect(weakPasswordReason("aaaaaaaaaaaa", "a@example.com")).toMatch(/too common/);
    expect(weakPasswordReason("adalovelace!!", "adalovelace@example.com")).toMatch(/email/);
    expect(weakPasswordReason("tea and bicycles", "ada@example.com")).toBeUndefined();
  });
});
