import { STAGING_PREFIX } from "./uploads";

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64url(new Uint8Array(signature));
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) {
    difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return difference === 0;
}

export async function issueUploadToken(
  secret: string,
  stagingKey: string,
  expiresAt: Date,
): Promise<string> {
  const payload = `${stagingKey}|${expiresAt.getTime()}`;
  return `${base64url(new TextEncoder().encode(payload))}.${await sign(secret, payload)}`;
}

// Only whoever was issued the upload can confirm it, since there are no learner sessions yet.
export async function verifyUploadToken(secret: string, token: unknown, now = new Date()) {
  if (typeof token !== "string" || !token.includes(".")) {
    throw new Error("Unknown upload.");
  }
  const [encoded = "", signature = ""] = token.split(".");
  let payload: string;
  try {
    const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    payload = new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  } catch {
    throw new Error("Unknown upload.");
  }
  if (!timingSafeEqual(signature, await sign(secret, payload))) {
    throw new Error("Unknown upload.");
  }
  const [stagingKey = "", expiresAt = "0"] = payload.split("|");
  if (!stagingKey.startsWith(STAGING_PREFIX) || Number(expiresAt) < now.getTime()) {
    throw new Error("Unknown upload.");
  }
  return stagingKey;
}
