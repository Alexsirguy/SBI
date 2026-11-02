import { describe, expect, it } from "vitest";
import { Account, LinkAccountRequest } from "./account-api";
import { CONSENT_VERSION } from "./consent";

const key = "photos/0192f1a0-0000-7000-8000-000000000001.jpg";
const consent = {
  choices: { account: true, "model-improvement": false, research: false, "save-photos": true },
  decidedAt: "2026-11-02T10:00:00.000Z",
  version: CONSENT_VERSION,
};

describe("account API contracts", () => {
  it("accepts a link request carrying the consent record and kept photo keys", () => {
    expect(LinkAccountRequest.parse({ consent, photoKeys: [key] }).photoKeys).toEqual([key]);
  });

  it("rejects keys outside the private photo prefix and oversized batches", () => {
    expect(LinkAccountRequest.safeParse({ consent, photoKeys: ["staging/x.jpg"] }).success).toBe(
      false,
    );
    expect(LinkAccountRequest.safeParse({ consent, photoKeys: Array(201).fill(key) }).success).toBe(
      false,
    );
  });

  it("holds no personal details, only an opaque id and dates", () => {
    const account = Account.parse({
      accountId: "0192f1a0-0000-7000-8000-000000000001",
      createdAt: "2026-11-02T10:00:00.000Z",
      email: "learner@example.com",
      linkedAt: null,
    });
    expect(account).not.toHaveProperty("email");
  });
});
