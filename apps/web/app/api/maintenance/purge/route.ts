import { NextResponse } from "next/server";
import { createDatabase } from "@sbi/db";
import { createRepositories } from "@sbi/db";
import { createR2Storage, readR2Env } from "@sbi/media";
import { isAuthorized, runPurge } from "./purge";

export async function POST(request: Request) {
  if (!isAuthorized(request.headers.get("authorization"), process.env.PURGE_TOKEN)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json({ error: "Photo maintenance is unavailable." }, { status: 503 });
  }
  let env;
  try {
    env = readR2Env(process.env);
  } catch {
    return NextResponse.json({ error: "Photo maintenance is unavailable." }, { status: 503 });
  }
  const handle = createDatabase(databaseUrl);
  try {
    const repos = createRepositories(handle.db);
    const result = await runPurge(
      {
        audit: repos.deletionAudit,
        registry: repos.mediaRegistry,
        storage: createR2Storage(env),
      },
      new Date(),
    );
    return NextResponse.json({ deleted: result.deleted.length });
  } catch {
    return NextResponse.json({ error: "Photo maintenance failed." }, { status: 502 });
  } finally {
    await handle.close();
  }
}
