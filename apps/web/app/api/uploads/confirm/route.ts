import { NextResponse } from "next/server";
import {
  confirmUpload,
  DEFAULT_UPLOAD_POLICY,
  ScanUnavailableError,
  UploadRejectedError,
  verifyUploadToken,
} from "@sbi/media";
import { mediaServer, UNAVAILABLE } from "../media-server";

export async function POST(request: Request) {
  const media = await mediaServer().catch(() => null);
  if (!media) {
    return NextResponse.json(UNAVAILABLE, { status: 503 });
  }
  let stagingKey: string;
  try {
    const body = (await request.json()) as { token?: unknown };
    stagingKey = await verifyUploadToken(media.uploadTokenSecret, body.token);
  } catch {
    return NextResponse.json({ error: "Unknown upload. Start the upload again." }, { status: 400 });
  }
  try {
    const confirmed = await confirmUpload({
      maxBytes: DEFAULT_UPLOAD_POLICY.maxBytes,
      policy: media.retention,
      registry: media.registry,
      scanner: media.scanner,
      stagingKey,
      storage: media.storage,
    });
    // TODO(#34): once recognition succeeds, call registry.expireSooner with recognisedExpiry.
    return NextResponse.json({ contentType: confirmed.contentType, key: confirmed.key });
  } catch (error) {
    if (error instanceof UploadRejectedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ScanUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: "The photo could not be verified." }, { status: 502 });
  }
}
