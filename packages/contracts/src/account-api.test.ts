import { describe, expect, it } from "vitest";
import {
  LinkAccountRequest,
  SignInRequest,
  SignUpRequest,
  VerifyEmailRequest,
} from "./account-api";
import { CONSENT_VERSION } from "./consent";

const key = "photos/0192f1a0-0000-7000-8000-000000000001.jpg";
const consent = {
  choices: { account: true, "model-improvement": false, research: false, "save-photos": true },
  decidedAt: "2026-11-02T10:00:00.000Z",
  version: CONSENT_VERSION,
};
const signUp = {
  age: "14",
  email: "  Ada@Example.COM ",
  firstName: " Ada ",
  lastName: "Lovelace",
  password: "correct horse battery",
};

describe("account API contracts", () => {
  it("normalises sign-up input: trimmed names, lowercased email, numeric age", () => {
    expect(SignUpRequest.parse(signUp)).toEqual({
      age: 14,
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      password: "correct horse battery",
      role: "learner",
    });
    expect(SignUpRequest.safeParse({ ...signUp, role: "admin" }).success).toBe(false);
  });

  it("refuses short passwords, bad emails and fractional ages", () => {
    expect(SignUpRequest.safeParse({ ...signUp, password: "short" }).success).toBe(false);
    expect(SignUpRequest.safeParse({ ...signUp, email: "nope" }).success).toBe(false);
    expect(SignUpRequest.safeParse({ ...signUp, age: 13.5 }).success).toBe(false);
    expect(SignInRequest.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });

  it("accepts only well-formed one-time tokens", () => {
    expect(VerifyEmailRequest.safeParse({ token: "A".repeat(43) }).success).toBe(true);
    expect(VerifyEmailRequest.safeParse({ token: "../x" }).success).toBe(false);
  });

  it("accepts a link request carrying the consent record and kept photo keys", () => {
    expect(LinkAccountRequest.parse({ consent, photoKeys: [key] }).photoKeys).toEqual([key]);
    expect(LinkAccountRequest.safeParse({ consent, photoKeys: ["staging/x.jpg"] }).success).toBe(
      false,
    );
  });
});
