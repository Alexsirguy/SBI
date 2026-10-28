import {
  createClamdScanner,
  createS3Storage,
  readMediaServerEnv,
  type MalwareScanner,
  type ObjectStorage,
} from "@sbi/media";

export interface MediaServer {
  storage: ObjectStorage;
  scanner: MalwareScanner;
  uploadTokenSecret: string;
}

let ready: Promise<MediaServer> | null = null;

// Null means uploads are unconfigured; the bucket's privacy is checked once per process.
export async function mediaServer(): Promise<MediaServer | null> {
  let env;
  try {
    env = readMediaServerEnv(process.env);
  } catch {
    return null;
  }
  ready ??= (async () => {
    const storage = createS3Storage(env.storage);
    await storage.ensurePrivateBucket();
    return {
      scanner: createClamdScanner(env.clamd),
      storage,
      uploadTokenSecret: env.uploadTokenSecret,
    };
  })();
  try {
    return await ready;
  } catch (error) {
    ready = null;
    throw error;
  }
}

export const UNAVAILABLE = { error: "Photo uploads are unavailable right now." } as const;
