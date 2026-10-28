import { createConnection } from "node:net";

export type ScanVerdict =
  | { status: "clean" }
  | { status: "infected"; signature: string }
  | { status: "error"; reason: string };

export interface MalwareScanner {
  scan(bytes: Uint8Array): Promise<ScanVerdict>;
}

export interface ClamdConfig {
  host: string;
  port: number;
  timeoutMs?: number;
}

const CHUNK_BYTES = 64 * 1024;

function lengthPrefix(length: number): Uint8Array {
  const prefix = new Uint8Array(4);
  new DataView(prefix.buffer).setUint32(0, length);
  return prefix;
}

export function parseClamdReply(reply: string): ScanVerdict {
  const text = reply.replace(/\0/g, "").trim();
  if (text.endsWith(": OK")) {
    return { status: "clean" };
  }
  const found = /: (.+) FOUND$/.exec(text);
  if (found?.[1]) {
    return { signature: found[1], status: "infected" };
  }
  return { reason: text || "empty reply", status: "error" };
}

// Speaks clamd's INSTREAM protocol; any failure is reported, never treated as clean.
export function createClamdScanner(config: ClamdConfig): MalwareScanner {
  return {
    scan: (bytes) =>
      new Promise<ScanVerdict>((resolve) => {
        const socket = createConnection({ host: config.host, port: config.port });
        let reply = "";
        let settled = false;
        const settle = (verdict: ScanVerdict) => {
          if (!settled) {
            settled = true;
            socket.destroy();
            resolve(verdict);
          }
        };
        socket.setTimeout(config.timeoutMs ?? 30_000, () =>
          settle({ reason: "scanner timed out", status: "error" }),
        );
        socket.on("error", (error) => settle({ reason: error.message, status: "error" }));
        socket.on("data", (data) => {
          reply += data.toString("utf8");
        });
        socket.on("end", () => settle(parseClamdReply(reply)));
        socket.on("connect", () => {
          socket.write("zINSTREAM\0");
          for (let start = 0; start < bytes.length; start += CHUNK_BYTES) {
            const chunk = bytes.subarray(start, start + CHUNK_BYTES);
            socket.write(lengthPrefix(chunk.length));
            socket.write(chunk);
          }
          socket.write(lengthPrefix(0));
        });
      }),
  };
}
