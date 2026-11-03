import "reflect-metadata";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import {
  ObjectMissingError,
  type MalwareScanner,
  type DeletionAuditEntry,
  type MediaObjectRecord,
  type ObjectStorage,
  type ScanVerdict,
} from "@sbi/media";
import type { RecognitionResult } from "@sbi/contracts";
import type { FallbackRecogniser, RecognitionResultRepository } from "@sbi/recognition";
import type { CatalogGapRepository } from "@sbi/taxonomy";
import { AppModule, configureApp } from "../app.module";
import { loadEnv } from "../env";
import { fakeAccountStore, fakeMailer, fakeSavedLessons, TEST_SCRYPT } from "./test-auth";
import {
  ACCOUNT_TOKENS,
  ACCOUNTS,
  COVERAGE,
  API_ENV,
  GOOGLE_VERIFIER,
  MAILER,
  PASSWORD_PARAMS,
  SAVED_LESSONS,
  SESSIONS,
  CATALOG_GAPS,
  DATABASE,
  FRESHNESS_PASS,
  MALWARE_SCANNER,
  DELETION_AUDIT,
  MEDIA_REGISTRY,
  OBJECT_STORAGE,
  PURGE_PASS,
  RECOGNISER,
  RECOGNITION_RESULTS,
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
  const expiredSooner = new Map<string, Date>();
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
  const consents = new Map<string, string>();
  const audit: DeletionAuditEntry[] = [];
  const known = (key: string) => records.some((record) => record.key === key);
  const registry = {
    expireSooner: async (key: string, at: Date) => void expiredSooner.set(key, at),
    keep: async (key: string, consentVersion: string) =>
      known(key) && !!consents.set(key, consentVersion) && kept.add(key).has(key),
    release: async (key: string) => known(key) && (kept.delete(key) || true),
    claimForDeletion: async (key: string) => known(key),
    forget: async (key: string) => {
      records.splice(
        records.findIndex((record) => record.key === key),
        1,
      );
    },
    register: async (record: MediaObjectRecord) => void records.push(record),
  };
  const deletionAudit = {
    record: async (entry: DeletionAuditEntry) => void audit.push(entry),
    purgeOlderThan: async () => 0,
  };
  return {
    audit,
    consents,
    deletionAudit,
    expiredSooner,
    kept,
    objects,
    records,
    registry,
    scanner,
    storage,
  };
}

export function fakeRecognition(recogniser: FallbackRecogniser | null = null) {
  const saved = new Map<string, RecognitionResult>();
  const results: RecognitionResultRepository = {
    deleteExpired: async () => 0,
    findByImage: async (imageSha256, now) =>
      [...saved.values()]
        .filter((r) => r.imageSha256 === imageSha256 && Date.parse(r.deleteBy) > now.getTime())
        .at(-1),
    get: async (resultId) => saved.get(resultId),
    listBySession: async (sessionId) =>
      [...saved.values()].filter((r) => r.sessionId === sessionId),
    save: async (result) => void saved.set(result.resultId, result),
    update: async (result) => saved.has(result.resultId) && !!saved.set(result.resultId, result),
  };
  return { recogniser, results, saved };
}

export function fakeGaps() {
  const recorded: { term: string; source: string }[] = [];
  const repository: CatalogGapRepository = {
    record: async (term, source) => void recorded.push({ source, term }),
    top: async () => [],
    deleteLastSeenBefore: async () => 0,
  };
  return { recorded, repository };
}

export interface TestApp {
  app: NestFastifyApplication;
  get(path: string, headers?: Record<string, string>): Promise<Response>;
  post(path: string, body: unknown, headers?: Record<string, string>): Promise<Response>;
  url: string;
}

// Real HTTP on a random port, so CORS and body parsing run exactly as in production.
export async function startTestApp(
  media = fakeMedia(),
  recognition = fakeRecognition(),
  gaps = fakeGaps(),
  /** Extra overrides for a test that needs one more provider replaced. */
  configure: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<TestApp> {
  const store = fakeAccountStore();
  const base = Test.createTestingModule({ imports: [AppModule] })
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
    .overrideProvider(DELETION_AUDIT)
    .useValue(media.deletionAudit)
    .overrideProvider(RECOGNISER)
    .useValue(recognition.recogniser)
    .overrideProvider(RECOGNITION_RESULTS)
    .useValue(recognition.results)
    .overrideProvider(CATALOG_GAPS)
    .useValue(gaps.repository)
    .overrideProvider(PURGE_PASS)
    .useValue(async () => ({ acquired: false }))
    .overrideProvider(FRESHNESS_PASS)
    .useValue(async () => ({ acquired: false }))
    .overrideProvider(ACCOUNTS)
    .useValue(store.accountRepo)
    .overrideProvider(SESSIONS)
    .useValue(store.sessionRepo)
    .overrideProvider(ACCOUNT_TOKENS)
    .useValue(store.tokenRepo)
    .overrideProvider(MAILER)
    .useValue(fakeMailer().send)
    .overrideProvider(GOOGLE_VERIFIER)
    .useValue(null)
    .overrideProvider(PASSWORD_PARAMS)
    .useValue(TEST_SCRYPT)
    .overrideProvider(SAVED_LESSONS)
    .useValue(fakeSavedLessons().repository)
    .overrideProvider(COVERAGE)
    .useValue({
      taughtBySubject: async () => [
        { lessons: 4, taxonomyId: "object.bicycle" },
        { lessons: 2, taxonomyId: "subject.hovercraft" },
        { lessons: 1, taxonomyId: "subject.rainbow" },
      ],
    });
  const moduleRef = await configure(base).compile();
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
    get: (path, headers = {}) => fetch(`${url}${path}`, { headers }),
    post: (path, body, headers = {}) =>
      fetch(`${url}${path}`, {
        body: typeof body === "string" ? body : JSON.stringify(body),
        headers: { "content-type": "application/json", ...headers },
        method: "POST",
      }),
    url,
  };
}
