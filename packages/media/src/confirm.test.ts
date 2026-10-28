import exifr from "exifr";
import { describe, expect, it } from "vitest";
import { confirmUpload, ScanUnavailableError, UploadRejectedError } from "./confirm";
import { cameraJpeg, SECRETS } from "./fixtures/camera-jpeg";
import { DEFAULT_RETENTION_POLICY, type MediaObjectRecord } from "./retention";
import type { MalwareScanner, ScanVerdict } from "./scanner";
import { ObjectMissingError, ObjectTooLargeError, type ObjectStorage } from "./storage";

const STAGING = "staging/abc.jpg";

function memoryStorage(initial: Record<string, Uint8Array>) {
  const objects = new Map(Object.entries(initial));
  const storage: ObjectStorage = {
    ensurePrivateBucket: () => Promise.resolve(),
    uploadOrigins: () => Promise.resolve([]),
    list: async () => [],
    presignPut: async () => "https://example.test/put",
    read: async (key, maxBytes) => {
      const bytes = objects.get(key);
      if (!bytes) {
        throw new ObjectMissingError(key);
      }
      if (bytes.length > maxBytes) {
        throw new ObjectTooLargeError(key);
      }
      return bytes;
    },
    remove: async (keys) => {
      for (const key of keys) {
        objects.delete(key);
      }
    },
    write: async (key, bytes) => {
      objects.set(key, bytes);
    },
  };
  return { objects, storage };
}

const scanner = (verdict: ScanVerdict): MalwareScanner => ({ scan: async () => verdict });

function recordingRegistry() {
  const records: MediaObjectRecord[] = [];
  return { records, register: async (record: MediaObjectRecord) => void records.push(record) };
}
const CLEAN = scanner({ status: "clean" });

describe("confirmUpload", () => {
  it("registers the original with its deletion date before storing it", async () => {
    const { storage } = memoryStorage({ [STAGING]: cameraJpeg() });
    const registry = recordingRegistry();
    const now = new Date("2026-10-28T10:00:00Z");
    const confirmed = await confirmUpload({
      maxBytes: 1e6,
      now,
      registry,
      scanner: CLEAN,
      stagingKey: STAGING,
      storage,
    });
    expect(registry.records).toEqual([
      {
        createdAt: now,
        expiresAt: new Date(now.getTime() + DEFAULT_RETENTION_POLICY.originalTtlDays * 86_400_000),
        key: confirmed.key,
        kind: "original",
      },
    ]);
  });

  it("moves verified, re-stripped bytes to a photo key and clears staging", async () => {
    const { objects, storage } = memoryStorage({ [STAGING]: cameraJpeg() });
    const confirmed = await confirmUpload({
      registry: recordingRegistry(),
      maxBytes: 1e6,
      scanner: CLEAN,
      stagingKey: STAGING,
      storage,
    });

    expect(confirmed.key).toMatch(/^photos\/[0-9a-f-]{36}\.jpg$/);
    expect(objects.has(STAGING)).toBe(false);
    const stored = objects.get(confirmed.key);
    if (!stored) {
      throw new Error("photo was not written");
    }
    const parsed: Record<string, unknown> = (await exifr.parse(stored, true)) ?? {};
    expect(parsed).not.toHaveProperty("Make");
    expect(parsed).not.toHaveProperty("latitude");
    expect(new TextDecoder("latin1").decode(stored)).not.toContain(SECRETS.serial);
  });

  it("rejects and deletes infected uploads", async () => {
    const { objects, storage } = memoryStorage({ [STAGING]: cameraJpeg() });
    await expect(
      confirmUpload({
        registry: recordingRegistry(),
        maxBytes: 1e6,
        scanner: scanner({ signature: "Eicar-Signature", status: "infected" }),
        stagingKey: STAGING,
        storage,
      }),
    ).rejects.toBeInstanceOf(UploadRejectedError);
    expect([...objects.keys()]).toEqual([]);
  });

  it("fails closed and deletes the upload when the scanner cannot answer", async () => {
    const { objects, storage } = memoryStorage({ [STAGING]: cameraJpeg() });
    await expect(
      confirmUpload({
        registry: recordingRegistry(),
        maxBytes: 1e6,
        scanner: scanner({ reason: "connection refused", status: "error" }),
        stagingKey: STAGING,
        storage,
      }),
    ).rejects.toBeInstanceOf(ScanUnavailableError);
    expect([...objects.keys()]).toEqual([]);
  });

  it.each([
    ["a non-image", new TextEncoder().encode("<script>alert(1)</script>"), "not a supported photo"],
    [
      "a HEIC file",
      new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99]),
      "JPEG or PNG",
    ],
    ["a truncated JPEG", new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]), "damaged"],
  ])("rejects %s with a learner-facing reason and deletes it", async (_, bytes, reason) => {
    const { objects, storage } = memoryStorage({ [STAGING]: bytes });
    const attempt = confirmUpload({
      registry: recordingRegistry(),
      maxBytes: 1e6,
      scanner: CLEAN,
      stagingKey: STAGING,
      storage,
    });
    await expect(attempt).rejects.toBeInstanceOf(UploadRejectedError);
    await expect(attempt).rejects.toThrow(reason);
    expect([...objects.keys()]).toEqual([]);
  });

  it("rejects objects over the size bound without reading them into memory", async () => {
    const { objects, storage } = memoryStorage({ [STAGING]: cameraJpeg() });
    await expect(
      confirmUpload({
        registry: recordingRegistry(),
        maxBytes: 10,
        scanner: CLEAN,
        stagingKey: STAGING,
        storage,
      }),
    ).rejects.toThrow("larger than allowed");
    expect(objects.size).toBe(0);
  });

  it("asks for a fresh upload when nothing arrived", async () => {
    const { storage } = memoryStorage({});
    await expect(
      confirmUpload({
        registry: recordingRegistry(),
        maxBytes: 1e6,
        scanner: CLEAN,
        stagingKey: STAGING,
        storage,
      }),
    ).rejects.toThrow("did not arrive");
  });
});
