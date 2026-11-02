import { describe, expect, it } from "vitest";
import { fakeProvider, TEST_ISSUER } from "../testing/test-auth";
import { InvalidTokenError } from "./token-verifier";

describe("createTokenVerifier", () => {
  it("returns the issuer and subject of a valid token", async () => {
    const { sign, verifier } = await fakeProvider();

    expect(await verifier(await sign("auth0|a"))).toEqual({
      issuer: TEST_ISSUER,
      subject: "auth0|a",
    });
  });

  it("rejects a token from another issuer", async () => {
    const { sign, verifier } = await fakeProvider();

    await expect(verifier(await sign("auth0|a", { issuer: "https://evil.test/" }))).rejects.toThrow(
      InvalidTokenError,
    );
  });
});
