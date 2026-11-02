import type { AccountRepository, StoredAccount } from "@sbi/db";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { createTokenVerifier } from "../account/token-verifier";

export const TEST_ISSUER = "https://id.test/";
export const TEST_AUDIENCE = "https://api.test";

/** A provider stand-in: signs tokens with a local key the verifier trusts. */
export async function fakeProvider() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), alg: "RS256", kid: "test" };
  const verifier = createTokenVerifier(
    { audience: TEST_AUDIENCE, issuer: TEST_ISSUER },
    createLocalJWKSet({ keys: [jwk] }),
  );
  const sign = (
    subject: string,
    { audience = TEST_AUDIENCE, issuer = TEST_ISSUER, expiresIn = "5m" } = {},
  ) =>
    new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setSubject(subject)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(privateKey);
  return { sign, verifier };
}

export function fakeAccounts() {
  const accounts = new Map<string, StoredAccount>();
  const owners = new Map<string, string>();
  const repository: AccountRepository = {
    findOrCreate: async (issuer, subject, now) => {
      const id = `${issuer} ${subject}`;
      const found = accounts.get(id) ?? {
        accountId: `0192f1a0-0000-7000-8000-${String(accounts.size + 1).padStart(12, "0")}`,
        consentVersion: null,
        createdAt: now,
        linkedAt: null,
      };
      accounts.set(id, found);
      return { ...found };
    },
    link: async (accountId, keys, consentVersion, now) => {
      for (const account of accounts.values()) {
        if (account.accountId === accountId)
          Object.assign(account, { consentVersion, linkedAt: now });
      }
      for (const key of keys) if (!owners.has(key)) owners.set(key, accountId);
      return keys.filter((key) => owners.get(key) === accountId).length;
    },
    unlink: async (accountId) => {
      const mine = [...owners].filter(([, owner]) => owner === accountId);
      for (const [key] of mine) owners.delete(key);
      for (const account of accounts.values()) {
        if (account.accountId === accountId)
          Object.assign(account, { consentVersion: null, linkedAt: null });
      }
      return mine.length;
    },
  };
  return { accounts, owners, repository };
}
