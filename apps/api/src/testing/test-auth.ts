import type {
  SavedLessonRepository,
  StoredSavedLesson,
  AccountRepository,
  AccountTokenRepository,
  SessionRepository,
  StoredAccount,
  TokenPurpose,
} from "@sbi/db";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { createGoogleVerifier } from "../account/google";
import type { Email } from "../account/mailer";

export const GOOGLE_CLIENT = "test-client.apps.googleusercontent.com";
// Cheap scrypt settings so tests run fast; production uses DEFAULT_SCRYPT.
export const TEST_SCRYPT = { N: 2 ** 10, p: 1, r: 8 };

/** In-memory stand-ins for the account tables, keeping the same uniqueness rules. */
export function fakeAccountStore() {
  const accounts = new Map<string, StoredAccount>();
  const owners = new Map<string, string>();
  const sessions = new Map<string, { accountId: string; expiresAt: Date }>();
  const tokens = new Map<string, { accountId: string; purpose: TokenPurpose; expiresAt: Date }>();
  // Copies, like rows read from the database, so callers cannot change stored state by accident.
  const find = (match: (account: StoredAccount) => boolean) => {
    const found = [...accounts.values()].find(match);
    return found && { ...found };
  };

  const accountRepo: AccountRepository = {
    create: async (input) => {
      if (
        find(
          (a) => a.email === input.email || (!!input.googleSub && a.googleSub === input.googleSub),
        )
      ) {
        return undefined;
      }
      const accountId = `0192f1a0-0000-7000-8000-${String(accounts.size + 1).padStart(12, "0")}`;
      const account: StoredAccount = { ...input, accountId, consentVersion: null, linkedAt: null };
      accounts.set(accountId, account);
      return { ...account };
    },
    get: async (accountId) => {
      const account = accounts.get(accountId);
      return account && { ...account };
    },
    findByEmail: async (email) => find((a) => a.email === email),
    findByGoogleSub: async (sub) => find((a) => a.googleSub === sub),
    update: async (accountId, changes) => {
      const account = accounts.get(accountId);
      if (account) Object.assign(account, changes);
    },
    link: async (accountId, keys, consentVersion, now) => {
      Object.assign(accounts.get(accountId) ?? {}, { consentVersion, linkedAt: now });
      for (const key of keys) if (!owners.has(key)) owners.set(key, accountId);
      return keys.filter((key) => owners.get(key) === accountId).length;
    },
    ownedPhotos: async (accountId) =>
      [...owners]
        .filter(([, owner]) => owner === accountId)
        .map(([key]) => ({ consentVersion: "consent-1", key })),
    delete: async (accountId) => {
      for (const [key, owner] of owners) if (owner === accountId) owners.delete(key);
      for (const [hash, session] of sessions)
        if (session.accountId === accountId) sessions.delete(hash);
      for (const [hash, token] of tokens) if (token.accountId === accountId) tokens.delete(hash);
      accounts.delete(accountId);
    },
    unlink: async (accountId) => {
      const mine = [...owners].filter(([, owner]) => owner === accountId);
      for (const [key] of mine) owners.delete(key);
      Object.assign(accounts.get(accountId) ?? {}, { consentVersion: null, linkedAt: null });
      return mine.length;
    },
  };

  const sessionRepo: SessionRepository = {
    create: async (hash, accountId, _now, expiresAt) =>
      void sessions.set(hash, { accountId, expiresAt }),
    find: async (hash, now) => {
      const session = sessions.get(hash);
      return session && session.expiresAt > now ? session.accountId : undefined;
    },
    delete: async (hash) => void sessions.delete(hash),
    deleteForAccount: async (accountId) => {
      for (const [hash, session] of sessions)
        if (session.accountId === accountId) sessions.delete(hash);
    },
    deleteExpired: async () => 0,
  };

  const tokenRepo: AccountTokenRepository = {
    issue: async (hash, accountId, purpose, expiresAt) => {
      for (const [other, token] of tokens) {
        if (token.accountId === accountId && token.purpose === purpose) tokens.delete(other);
      }
      tokens.set(hash, { accountId, expiresAt, purpose });
    },
    peek: async (hash, purpose, now) => {
      const token = tokens.get(hash);
      return token && token.purpose === purpose && token.expiresAt > now
        ? token.accountId
        : undefined;
    },
    consume: async (hash, purpose, now) => {
      const token = tokens.get(hash);
      if (!token || token.purpose !== purpose) return undefined;
      tokens.delete(hash);
      return token.expiresAt > now ? token.accountId : undefined;
    },
    deleteExpired: async () => 0,
  };

  return { accountRepo, accounts, owners, sessionRepo, sessions, tokenRepo, tokens };
}

/** Collects sent emails so tests can follow the links in them. */
export function fakeMailer() {
  const sent: Email[] = [];
  const send = async (email: Email) => void sent.push(email);
  const linkIn = (email: Email | undefined) =>
    /token=([A-Za-z0-9_-]{43})/.exec(email?.text ?? "")?.[1] ?? "";
  return { linkIn, send, sent };
}

/** Google stand-in: signs ID tokens with a local key the verifier trusts. */
export async function fakeGoogle() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), alg: "RS256", kid: "google-test" };
  const verifier = createGoogleVerifier(GOOGLE_CLIENT, createLocalJWKSet({ keys: [jwk] }));
  const sign = (
    claims: {
      sub: string;
      email: string;
      email_verified?: boolean;
      given_name?: string;
      family_name?: string;
    },
    { audience = GOOGLE_CLIENT, issuer = "https://accounts.google.com" } = {},
  ) =>
    new SignJWT({ email_verified: true, family_name: "Lovelace", given_name: "Ada", ...claims })
      .setProtectedHeader({ alg: "RS256", kid: "google-test" })
      .setSubject(claims.sub)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
  return { sign, verifier };
}

/** The session cookie value from a response, for sending back like a browser would. */
export function sessionFrom(response: Response): string {
  const header = response.headers.get("set-cookie") ?? "";
  const value = /sbi_session=([^;]*)/.exec(header)?.[1] ?? "";
  return `sbi_session=${value}`;
}

export function fakeSavedLessons() {
  const rows = new Map<string, StoredSavedLesson>();
  const key = (accountId: string, lessonId: string) => `${accountId} ${lessonId}`;
  const repository: SavedLessonRepository = {
    save: async (accountId, lesson) =>
      void rows.set(key(accountId, lesson.lessonId), { ...lesson }),
    list: async (accountId) =>
      [...rows]
        .filter(([id]) => id.startsWith(`${accountId} `))
        .map(([, lesson]) => lesson)
        .sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime()),
    get: async (accountId, lessonId) => rows.get(key(accountId, lessonId)),
    remove: async (accountId, lessonId) => void rows.delete(key(accountId, lessonId)),
    markShared: async (accountId, lessonId, _sharedId, at) => {
      const row = rows.get(key(accountId, lessonId));
      if (!row || row.sharedAt) return false;
      row.sharedAt = at;
      return true;
    },
  };
  return { repository, rows };
}
