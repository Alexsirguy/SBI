import { createServer, type AddressInfo, type Server } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createClamdScanner, parseClamdReply } from "./scanner";

let server: Server | undefined;

afterEach(() => {
  server?.close();
  server = undefined;
});

// Minimal clamd stand-in: records the INSTREAM payload, then answers with `reply`.
async function fakeClamd(reply: (payload: Buffer) => string | null) {
  const received: Buffer[] = [];
  server = createServer((socket) => {
    let buffer = Buffer.alloc(0);
    socket.on("data", (data) => {
      buffer = Buffer.concat([buffer, data]);
      if (buffer.subarray(-4).readUInt32BE(0) === 0 && buffer.length > 14) {
        received.push(buffer);
        const answer = reply(buffer);
        if (answer !== null) {
          socket.end(`${answer}\0`);
        }
      }
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { port, received };
}

describe("parseClamdReply", () => {
  it("maps clamd replies to verdicts", () => {
    expect(parseClamdReply("stream: OK\0")).toEqual({ status: "clean" });
    expect(parseClamdReply("stream: Eicar-Test-Signature FOUND\0")).toEqual({
      signature: "Eicar-Test-Signature",
      status: "infected",
    });
    expect(parseClamdReply("INSTREAM size limit exceeded. ERROR")).toMatchObject({
      status: "error",
    });
    expect(parseClamdReply("")).toMatchObject({ status: "error" });
  });
});

describe("createClamdScanner", () => {
  it("streams the bytes with INSTREAM framing", async () => {
    const { port, received } = await fakeClamd(() => "stream: OK");
    const verdict = await createClamdScanner({ host: "127.0.0.1", port }).scan(
      new Uint8Array([1, 2, 3]),
    );
    expect(verdict).toEqual({ status: "clean" });
    expect([...(received[0] ?? [])]).toEqual([
      ...Buffer.from("zINSTREAM\0"),
      0,
      0,
      0,
      3,
      1,
      2,
      3,
      0,
      0,
      0,
      0,
    ]);
  });

  it("reports infections", async () => {
    const { port } = await fakeClamd(() => "stream: Eicar-Test-Signature FOUND");
    await expect(
      createClamdScanner({ host: "127.0.0.1", port }).scan(new Uint8Array([1])),
    ).resolves.toEqual({ signature: "Eicar-Test-Signature", status: "infected" });
  });

  it("never treats an unreachable or silent scanner as clean", async () => {
    const { port } = await fakeClamd(() => null);
    await expect(
      createClamdScanner({ host: "127.0.0.1", port, timeoutMs: 50 }).scan(new Uint8Array([1])),
    ).resolves.toMatchObject({ status: "error" });
    await expect(
      createClamdScanner({ host: "127.0.0.1", port: 1 }).scan(new Uint8Array([1])),
    ).resolves.toMatchObject({ status: "error" });
  });
});
