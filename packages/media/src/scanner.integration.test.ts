import { describe, expect, it } from "vitest";
import { cameraJpeg } from "./fixtures/camera-jpeg";
import { createClamdScanner } from "./scanner";

const host = process.env.TEST_CLAMAV_HOST;

// The harmless EICAR test file; assembled at runtime so this source file itself is not flagged.
const EICAR = ["X5O!P%@AP[4\\PZX54(P^)7CC)7}$", "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"].join(
  "",
);

describe.skipIf(!host)("ClamAV scanner against a real clamd", { timeout: 30_000 }, () => {
  const scanner = createClamdScanner({
    host: host ?? "",
    port: Number(process.env.TEST_CLAMAV_PORT ?? 3310),
  });

  it("flags the EICAR test file", async () => {
    await expect(scanner.scan(new TextEncoder().encode(EICAR))).resolves.toMatchObject({
      status: "infected",
    });
  });

  it("passes a real photo", async () => {
    await expect(scanner.scan(cameraJpeg())).resolves.toEqual({ status: "clean" });
  });
});
