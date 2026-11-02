import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

// OWASP's scrypt floor; parameters are stored with each hash so they can be raised later.
export const DEFAULT_SCRYPT: ScryptParams = { N: 2 ** 17, r: 8, p: 1 };
const KEY_LENGTH = 32;

function derive(password: string, salt: Buffer, { N, r, p }: ScryptParams): Promise<Buffer> {
  // scrypt needs 128·N·r bytes; Node's default 32 MB cap is below OWASP's parameters.
  const options: ScryptOptions = { N, r, p, maxmem: 256 * N * r };
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string, params = DEFAULT_SCRYPT): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, params);
  return [
    "scrypt",
    params.N,
    params.r,
    params.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Long enough to pass the length rule yet among the first tried in any guessing attack.
const COMMON = new Set([
  "1234567890",
  "12345678910",
  "123456789a",
  "0987654321",
  "1111111111",
  "0000000000",
  "1q2w3e4r5t",
  "qwertyuiop",
  "asdfghjkl1",
  "password12",
  "password123",
  "password1234",
  "passw0rd123",
  "iloveyou12",
  "iloveyou123",
  "football123",
  "baseball123",
  "princess123",
  "sunshine123",
  "letmein1234",
  "welcome123",
  "abc1234567",
  "abcdefghij",
  "qwerty12345",
  "qwerty123456",
  "monkey12345",
  "dragon12345",
  "minecraft1",
  "minecraft123",
  "superman123",
]);

/** A reason to refuse the password, or undefined when it is acceptable. */
export function weakPasswordReason(password: string, email: string): string | undefined {
  const lowered = password.toLowerCase();
  if (COMMON.has(lowered) || /^(.)\1+$/.test(password)) {
    return "That password is too common. Try a short phrase only you would think of.";
  }
  const name = email.split("@")[0] ?? "";
  if (name.length >= 4 && lowered.includes(name)) {
    return "Choose a password that does not contain your email address.";
  }
  return undefined;
}
