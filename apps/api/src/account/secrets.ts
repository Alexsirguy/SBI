import { createHash, randomBytes } from "node:crypto";

/** A random 32-byte token for a cookie or email link, and the hash we store instead of it. */
export function newSecret(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { hash: hashSecret(token), token };
}

export function hashSecret(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
