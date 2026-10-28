import "reflect-metadata";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import {
  ObjectMissingError,
  type MalwareScanner,
  type MediaObjectRecord,
  type ObjectStorage,
  type ScanVerdict,
} from "@sbi/media";
import { AppModule, configureApp } from "../app.module";
import { loadEnv } from "../env";
import {
  API_ENV,
  DATABASE,
  MALWARE_SCANNER,
  MEDIA_REGISTRY,
  OBJECT_STORAGE,
  PURGE_PASS,
} from "../tokens";

export const WEB_ORIGIN = "http://localhost:3000";
export const TOKEN_SECRET = "s".repeat(32);

export const testEnv = loadEnv({
  CLAMAV_HOST: "127.0.0.1",
  DATABASE_URL: "mysql://sbi:sbi@localhost:3306/sbi",
  S3_ACCESS_KEY_ID: "sbi",
  S3_BUCKET: "sbi-media",
  S3_ENDPOINT: "http://localhost:8333",
  S3_REGION: "us-east-1",
  S3_SECRET_ACCESS_KEY: "secret",
  UPLOAD_TOKEN_SECRET: TOKEN_SECRET,
  WEB_ORIGINS: WEB_ORIGIN,
});

export function fakeMedia(verdict: ScanVerdict = { status: "clean" }) {
  const objects = new Map<string, Uint8Array>();
  const records: MediaObjectRecord[] = [];
  const kept = new Set<string>();
  const storage: ObjectStorage = {
    ensurePrivateBucket: async () => undefined,
    list: async () => [],
    presignPut: async ({ key }) => `https://storage.test/${key}?signed`,
    read: async (key) => {
      const bytes = objects.get(key);
      if (!bytes) {
        throw new ObjectMissingError(key);
      }
      return bytes;
    },
    remove: async (keys) => keys.forEach((key) => objects.delete(key)),
    uploadOrigins: async () => [WEB_ORIGIN],
    write: async (key, bytes) => void objects.set(key, bytes),
  };
  const scanner: MalwareScanner = { scan: async () => verdict };
  const registry = {
    keep: async (key: string) =>
      records.some((record) => record.key === key) && kept.add(key).has(key),
    register: async (record: MediaObjectRecord) => void records.push(record),
  };
  return { kept, objects, records, registry, scanner, storage };
}

export interface TestApp {
  app: NestFastifyApplication;
  post(path: string, body: unknown, headers?: Record<string, string>): Promise<Response>;
  url: string;
}

// Real HTTP on a random port, so CORS and body parsing run exactly as in production.
export async function startTestApp(media = fakeMedia()): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(API_ENV)
    .useValue(testEnv)
    .overrideProvider(DATABASE)
    .useValue({ close: async () => undefined })
    .overrideProvider(OBJECT_STORAGE)
    .useValue(media.storage)
    .overrideProvider(MALWARE_SCANNER)
    .useValue(media.scanner)
    .overrideProvider(MEDIA_REGISTRY)
    .useValue(media.registry)
    .overrideProvider(PURGE_PASS)
    .useValue(async () => ({ acquired: false }))
    .compile();
  const app = configureApp(
    moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      logger: false,
    }),
    testEnv.webOrigins,
  );
  await app.listen({ host: "127.0.0.1", port: 0 });
  const url = await app.getUrl();
  return {
    app,
    post: (path, body, headers = {}) =>
      fetch(`${url}${path}`, {
        body: typeof body === "string" ? body : JSON.stringify(body),
        headers: { "content-type": "application/json", ...headers },
        method: "POST",
      }),
    url,
  };
}
