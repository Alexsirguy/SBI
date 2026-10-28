import { NextResponse } from "next/server";
import { loggingMalwareScanHook, presignR2Url, readR2Env } from "@sbi/media";
import { UploadClientError, assertOwnUploadKey, verifyAndCleanse } from "./verify";

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("The photo did not arrive. Upload it again.");
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function POST(request: Request) {
  let env;
  try {
    env = readR2Env(process.env);
  } catch {
    return NextResponse.json(
      { error: "Photo uploads are unavailable right now." },
      { status: 503 },
    );
  }
  let key: string;
  try {
    const body = (await request.json()) as { key?: unknown };
    key = assertOwnUploadKey(body.key);
  } catch {
    return NextResponse.json({ error: "Unknown upload. Start the upload again." }, { status: 400 });
  }
  try {
    const stored = await fetchBytes(
      await presignR2Url(env, { expiresInSeconds: 60, key, method: "GET" }),
    );
    const cleansed = verifyAndCleanse(stored);
    if (cleansed.changed) {
      const rewrite = await presignR2Url(env, { expiresInSeconds: 60, key, method: "PUT" });
      const response = await fetch(rewrite, {
        body: new Uint8Array(cleansed.bytes).buffer,
        method: "PUT",
      });
      if (!response.ok) {
        throw new Error("The photo could not be cleaned. Upload it again.");
      }
    }
    await loggingMalwareScanHook((message) => console.info(message)).requestScan(key);
    return NextResponse.json({ contentType: cleansed.contentType, key });
  } catch (error) {
    if (error instanceof UploadClientError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "The photo could not be verified." }, { status: 502 });
  }
}
