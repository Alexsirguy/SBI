import { NextResponse } from "next/server";
import { presignR2Url, readR2Env, validateUploadIntent } from "@sbi/media";
import { expiryWithinLimit, parseUploadRequest } from "./request";

export async function POST(request: Request) {
  let env;
  try {
    env = readR2Env(process.env);
  } catch {
    // Configuration state is not the learner's problem to diagnose.
    return NextResponse.json(
      { error: "Photo uploads are unavailable right now." },
      { status: 503 },
    );
  }
  let intent;
  try {
    intent = parseUploadRequest(await request.json());
  } catch {
    return NextResponse.json({ error: "That upload request was malformed." }, { status: 400 });
  }
  try {
    const accepted = validateUploadIntent(intent);
    if (!expiryWithinLimit(accepted.expiresInSeconds)) {
      throw new Error("Upload window out of bounds.");
    }
    const uploadUrl = await presignR2Url(env, {
      expiresInSeconds: accepted.expiresInSeconds,
      key: accepted.key,
      method: "PUT",
    });
    return NextResponse.json({
      expiresInSeconds: accepted.expiresInSeconds,
      key: accepted.key,
      uploadUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Uploads accept photos only.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
