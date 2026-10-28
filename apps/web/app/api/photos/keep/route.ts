import { NextResponse } from "next/server";
import { PHOTO_PREFIX } from "@sbi/media";
import { mediaServer, UNAVAILABLE } from "../../uploads/media-server";

const PHOTO_KEY = /^photos\/[0-9a-f-]{36}\.(jpg|png)$/;

// Photo keys are unguessable UUIDs handed only to the uploader, so holding one is the permission.
export async function POST(request: Request) {
  const media = await mediaServer().catch(() => null);
  if (!media) {
    return NextResponse.json(UNAVAILABLE, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as { key?: unknown };
  if (
    typeof body.key !== "string" ||
    !body.key.startsWith(PHOTO_PREFIX) ||
    !PHOTO_KEY.test(body.key)
  ) {
    return NextResponse.json({ error: "Unknown photo." }, { status: 400 });
  }
  try {
    if (!(await media.registry.keep(body.key))) {
      return NextResponse.json(
        { error: "This photo has already been deleted and cannot be kept." },
        { status: 409 },
      );
    }
    return NextResponse.json({ kept: true });
  } catch {
    return NextResponse.json({ error: "The photo could not be kept. Try again." }, { status: 502 });
  }
}
