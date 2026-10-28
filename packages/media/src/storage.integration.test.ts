import { describe, expect, it } from "vitest";
import { createS3Storage, ObjectTooLargeError } from "./storage";

const endpoint = process.env.TEST_S3_ENDPOINT;

// Runs against the local SeaweedFS from docker-compose (and in CI) when TEST_S3_ENDPOINT is set.
describe.skipIf(!endpoint)("S3 storage against a real server", { timeout: 30_000 }, () => {
  // One shared bucket keeps SeaweedFS from allocating volumes per run; prefixes isolate runs.
  const run = `run-${Date.now()}/`;
  const storage = createS3Storage({
    accessKeyId: process.env.TEST_S3_ACCESS_KEY_ID ?? "sbi",
    bucket: "sbi-test",
    endpoint: endpoint ?? "",
    forcePathStyle: true,
    region: "us-east-1",
    secretAccessKey: process.env.TEST_S3_SECRET_ACCESS_KEY ?? "sbi-local-secret",
    uploadOrigins: ["http://localhost:3100"],
  });

  it("creates the bucket, proves anonymous reads are refused and limits CORS to the app", async () => {
    await expect(storage.ensurePrivateBucket()).resolves.toBeUndefined();
    await expect(storage.uploadOrigins()).resolves.toEqual(["http://localhost:3100"]);
  });

  it("accepts a presigned PUT only for the signed length", async () => {
    const url = await storage.presignPut({
      contentLength: 3,
      contentType: "image/jpeg",
      expiresInSeconds: 60,
      key: `${run}staging/signed.jpg`,
    });
    const wrong = await fetch(url, {
      body: new Uint8Array([1, 2, 3, 4]),
      headers: { "content-type": "image/jpeg" },
      method: "PUT",
    });
    expect(wrong.ok).toBe(false);
    const right = await fetch(url, {
      body: new Uint8Array([1, 2, 3]),
      headers: { "content-type": "image/jpeg" },
      method: "PUT",
    });
    expect(right.ok).toBe(true);
    expect([...(await storage.read(`${run}staging/signed.jpg`, 10))]).toEqual([1, 2, 3]);
  });

  it("refuses to read objects over the size bound and lists and removes by prefix", async () => {
    await storage.write(`${run}photos/big.jpg`, new Uint8Array(100), "image/jpeg");
    await expect(storage.read(`${run}photos/big.jpg`, 10)).rejects.toBeInstanceOf(
      ObjectTooLargeError,
    );
    expect((await storage.list(`${run}photos/`)).map((object) => object.key)).toEqual([
      `${run}photos/big.jpg`,
    ]);
    await storage.remove([`${run}photos/big.jpg`, `${run}staging/signed.jpg`]);
    expect(await storage.list(run)).toEqual([]);
  });
});
