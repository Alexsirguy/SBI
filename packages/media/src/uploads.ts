import { detectImageType, type UploadableImageType } from "./image-type";

export interface UploadPolicy {
  allowedTypes?: UploadableImageType[];
  maxBytes?: number;
  keyPrefix?: string;
  expiresInSeconds?: number;
}

export interface UploadIntent {
  declaredType: string;
  sizeBytes: number;
  filename: string;
}

export interface AcceptedUpload {
  key: string;
  contentType: UploadableImageType;
  expiresInSeconds: number;
}

export const DEFAULT_UPLOAD_POLICY = {
  allowedTypes: ["image/jpeg", "image/png", "image/heic"],
  expiresInSeconds: 300,
  keyPrefix: "uploads",
  maxBytes: 10 * 1024 * 1024,
} as const;

// Server-side gate: the browser's declared type is never trusted on its own.
export function validateUploadIntent(
  intent: UploadIntent,
  policy: UploadPolicy = {},
): AcceptedUpload {
  const allowedTypes = policy.allowedTypes ?? [...DEFAULT_UPLOAD_POLICY.allowedTypes];
  const maxBytes = policy.maxBytes ?? DEFAULT_UPLOAD_POLICY.maxBytes;
  const expiresInSeconds = policy.expiresInSeconds ?? DEFAULT_UPLOAD_POLICY.expiresInSeconds;
  if (!allowedTypes.includes(intent.declaredType as UploadableImageType)) {
    throw new Error(`Uploads accept ${allowedTypes.join(", ")} only.`);
  }
  if (!Number.isInteger(intent.sizeBytes) || intent.sizeBytes <= 0 || intent.sizeBytes > maxBytes) {
    throw new Error(`Uploads must be between 1 byte and ${maxBytes} bytes.`);
  }
  return {
    contentType: intent.declaredType as UploadableImageType,
    expiresInSeconds,
    key: createObjectKey(policy.keyPrefix ?? DEFAULT_UPLOAD_POLICY.keyPrefix, intent.filename),
  };
}

// Keys are server-generated so clients cannot overwrite each other's objects.
export function createObjectKey(prefix: string, filename: string, randomId?: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "photo";
  const safe =
    base
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 120) || "photo";
  const id = randomId ?? crypto.randomUUID();
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}/${date}/${id}-${safe}`;
}

export interface R2Env {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export type EnvSource = Record<string, string | undefined>;

// Throws when storage is unconfigured so routes fail closed, never open.
export function readR2Env(source: EnvSource): R2Env {
  const accountId = source.R2_ACCOUNT_ID;
  const accessKeyId = source.R2_ACCESS_KEY_ID;
  const secretAccessKey = source.R2_SECRET_ACCESS_KEY;
  const bucket = source.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Private image storage is not configured.");
  }
  return { accessKeyId, accountId, bucket, secretAccessKey };
}

export interface MalwareScanHook {
  requestScan(objectKey: string): Promise<void>;
}

// Records the request for the out-of-band scanner; scanning itself is external.
export function loggingMalwareScanHook(sink: (message: string) => void): MalwareScanHook {
  return {
    async requestScan(objectKey: string) {
      sink(`Malware scan requested for ${objectKey}.`);
    },
  };
}

export function sniffImageType(bytes: Uint8Array): UploadableImageType {
  const detected = detectImageType(bytes);
  if (!detected) {
    throw new Error("The stored object is not a supported photo.");
  }
  return detected;
}
