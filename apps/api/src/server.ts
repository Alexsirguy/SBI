import { createDatabase, createRepositories } from "@sbi/db";
import { createS3Storage, runDeletionPass } from "@sbi/media";
import { buildApp } from "./app";
import { loadEnv } from "./env";
import { startPurgeWorker } from "./workers/purge";

const env = loadEnv();
const app = buildApp();
const database = createDatabase(env.DATABASE_URL);
const repos = createRepositories(database.db);
const storage = createS3Storage({
  accessKeyId: env.S3_ACCESS_KEY_ID,
  bucket: env.S3_BUCKET,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  region: env.S3_REGION,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  uploadOrigins: [],
});

const purge = startPurgeWorker({
  intervalMs: env.MEDIA_PURGE_INTERVAL_MINUTES * 60_000,
  log: app.log,
  runPass: () =>
    database.withLock("media-purge", () =>
      runDeletionPass(
        { audit: repos.deletionAudit, registry: repos.mediaRegistry, storage },
        new Date(),
        env.retention,
      ),
    ),
});

app.addHook("onClose", async () => {
  purge.stop();
  await database.close();
});

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
