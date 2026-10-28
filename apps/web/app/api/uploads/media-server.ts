import { createDatabase, createRepositories } from "@sbi/db";
import {
  createClamdScanner,
  parseRetentionPolicy,
  createS3Storage,
  readMediaServerEnv,
  type MalwareScanner,
  type MediaRegistry,
  type ObjectStorage,
  type RetentionPolicy,
} from "@sbi/media";

export interface MediaServer {
  storage: ObjectStorage;
  scanner: MalwareScanner;
  registry: MediaRegistry;
  retention: RetentionPolicy;
  uploadTokenSecret: string;
}

let ready: Promise<MediaServer> | null = null;

// Null means uploads are unconfigured; the bucket's privacy is checked once per process.
export async function mediaServer(): Promise<MediaServer | null> {
  let env;
  let retention;
  const databaseUrl = process.env.DATABASE_URL;
  try {
    env = readMediaServerEnv(process.env);
    retention = parseRetentionPolicy(process.env);
  } catch {
    return null;
  }
  // Without the registry a stored photo would never be deleted, so uploads stay off.
  if (!databaseUrl) {
    return null;
  }
  ready ??= (async () => {
    const storage = createS3Storage(env.storage);
    await storage.ensurePrivateBucket();
    return {
      registry: createRepositories(createDatabase(databaseUrl).db).mediaRegistry,
      retention,
      scanner: createClamdScanner(env.clamd),
      storage,
      uploadTokenSecret: env.uploadTokenSecret,
    };
  })();
  try {
    return await ready;
  } catch (error) {
    ready = null;
    // Storage errors carry no learner data, and operators need to see why uploads are off.
    console.error("Media storage is unavailable:", error instanceof Error ? error.message : error);
    throw error;
  }
}

export const UNAVAILABLE = { error: "Photo uploads are unavailable right now." } as const;
