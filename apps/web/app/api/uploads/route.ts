import { NextResponse } from "next/server";
import { DEFAULT_UPLOAD_POLICY, issueUploadToken, validateUploadIntent } from "@sbi/media";
import { mediaServer, UNAVAILABLE } from "./media-server";
import { parseUploadRequest } from "./request";

// Gives a slow connection time to finish the PUT before confirming.
const CONFIRM_GRACE_SECONDS = 600;

export async function POST(request: Request) {
  const media = await mediaServer().catch(() => null);
  if (!media) {
    return NextResponse.json(UNAVAILABLE, { status: 503 });
  }
  // TODO(#120): rate-limit upload requests per client before signing URLs.
  let accepted;
  try {
    accepted = validateUploadIntent(
      parseUploadRequest(await request.json()),
      DEFAULT_UPLOAD_POLICY,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload a JPG or PNG photo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  try {
    const uploadUrl = await media.storage.presignPut({
      contentLength: accepted.sizeBytes,
      contentType: accepted.contentType,
      expiresInSeconds: accepted.expiresInSeconds,
      key: accepted.stagingKey,
    });
    const expiresAt = new Date(
      Date.now() + (accepted.expiresInSeconds + CONFIRM_GRACE_SECONDS) * 1000,
    );
    const token = await issueUploadToken(media.uploadTokenSecret, accepted.stagingKey, expiresAt);
    return NextResponse.json({ expiresInSeconds: accepted.expiresInSeconds, token, uploadUrl });
  } catch {
    return NextResponse.json(UNAVAILABLE, { status: 503 });
  }
}
