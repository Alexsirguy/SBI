export interface R2Credentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface PresignInput {
  method: "GET" | "PUT";
  key: string;
  expiresInSeconds: number;
  now?: Date;
}

export const MAX_PRESIGN_EXPIRY_SECONDS = 900;

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function amzDate(date: Date): { day: string; dateTime: string } {
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
  const time = `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
  return { dateTime: `${day}T${time}Z`, day };
}

async function toKeyData(key: Uint8Array | string): Promise<CryptoKey> {
  const bytes = new Uint8Array(typeof key === "string" ? new TextEncoder().encode(key) : key);
  return crypto.subtle.importKey("raw", bytes.buffer, { hash: "SHA-256", name: "HMAC" }, false, [
    "sign",
  ]);
}

export async function hmac(key: Uint8Array | string, message: string): Promise<Uint8Array> {
  const cryptoKey = await toKeyData(key);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(signature);
}

async function sha256Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export interface CanonicalParts {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  payloadHash: string;
}

// Exported so tests can verify the SigV4 core against published vectors.
export function createCanonicalRequest(parts: CanonicalParts): string {
  const encodedPath = parts.path
    .split("/")
    .map((segment) => encodeRfc3986(decodeURIComponent(segment)))
    .join("/");
  const canonicalQuery = Object.keys(parts.query)
    .sort()
    .map((name) => `${encodeRfc3986(name)}=${encodeRfc3986(parts.query[name] ?? "")}`)
    .join("&");
  const names = Object.keys(parts.headers).sort();
  const canonicalHeaders = names
    .map((name) => `${name}:${(parts.headers[name] ?? "").trim()}\n`)
    .join("");
  return [
    parts.method,
    encodedPath,
    canonicalQuery,
    canonicalHeaders,
    names.join(";"),
    parts.payloadHash,
  ].join("\n");
}

export async function createStringToSign(
  canonicalRequest: string,
  dateTime: string,
  day: string,
  region: string,
  service: string,
): Promise<string> {
  const scope = `${day}/${region}/${service}/aws4_request`;
  const hashed = await sha256Hex(canonicalRequest);
  return ["AWS4-HMAC-SHA256", dateTime, scope, hashed].join("\n");
}

export async function deriveSigningKey(
  secretAccessKey: string,
  day: string,
  region: string,
  service: string,
): Promise<Uint8Array> {
  const dateKey = await hmac(`AWS4${secretAccessKey}`, day);
  const regionKey = await hmac(dateKey, region);
  const serviceKey = await hmac(regionKey, service);
  return hmac(serviceKey, "aws4_request");
}

const R2_REGION = "auto";
const R2_SERVICE = "s3";

function endpoint(credentials: R2Credentials): string {
  return `https://${credentials.accountId}.r2.cloudflarestorage.com`;
}

function requireKey(key: string): void {
  if (!key || key.startsWith("/") || key.includes("..")) {
    throw new Error("Invalid object key.");
  }
}

// Short expiry bounds how long a leaked URL stays usable.
export async function presignR2Url(
  credentials: R2Credentials,
  input: PresignInput,
): Promise<string> {
  requireKey(input.key);
  if (
    !Number.isInteger(input.expiresInSeconds) ||
    input.expiresInSeconds < 1 ||
    input.expiresInSeconds > MAX_PRESIGN_EXPIRY_SECONDS
  ) {
    throw new Error(`Expiry must be between 1 and ${MAX_PRESIGN_EXPIRY_SECONDS} seconds.`);
  }
  const now = input.now ?? new Date();
  const { dateTime, day } = amzDate(now);
  const host = `${credentials.accountId}.r2.cloudflarestorage.com`;
  const path = `/${credentials.bucket}/${input.key}`;
  const credential = `${credentials.accessKeyId}/${day}/${R2_REGION}/${R2_SERVICE}/aws4_request`;
  const query = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD",
    "X-Amz-Credential": credential,
    "X-Amz-Date": dateTime,
    "X-Amz-Expires": String(input.expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalRequest = createCanonicalRequest({
    headers: { host },
    method: input.method,
    path,
    payloadHash: "UNSIGNED-PAYLOAD",
    query,
  });
  const stringToSign = await createStringToSign(
    canonicalRequest,
    dateTime,
    day,
    R2_REGION,
    R2_SERVICE,
  );
  const signingKey = await deriveSigningKey(
    credentials.secretAccessKey,
    day,
    R2_REGION,
    R2_SERVICE,
  );
  const signatureBytes = await hmac(signingKey, stringToSign);
  const signature = [...signatureBytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const signedQuery = Object.entries(query)
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([name, value]) => `${encodeRfc3986(name)}=${encodeRfc3986(value)}`)
    .join("&");
  return `${endpoint(credentials)}${path}?${signedQuery}&X-Amz-Signature=${signature}`;
}
