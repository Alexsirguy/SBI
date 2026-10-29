import {
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import type { DatabaseHandle, LockResult, Repositories } from "@sbi/db";
import { runDeletionPass, type ObjectStorage, type RetentionPolicy } from "@sbi/media";
import type { ApiEnv } from "../env";
import { MediaModule } from "../media/media.module";
import {
  API_ENV,
  DATABASE,
  OBJECT_STORAGE,
  PURGE_PASS,
  REPOSITORIES,
  RETENTION_POLICY,
} from "../tokens";
import { startPurgeWorker, type PurgePassResult, type PurgeWorker } from "./purge-worker";

export type PurgePass = () => Promise<LockResult<PurgePassResult>>;

@Injectable()
export class PurgeService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("MediaPurge");
  private worker: PurgeWorker | null = null;

  constructor(
    @Inject(PURGE_PASS) private readonly runPass: PurgePass,
    @Inject(API_ENV) private readonly env: Pick<ApiEnv, "MEDIA_PURGE_INTERVAL_MINUTES">,
  ) {}

  onApplicationBootstrap() {
    this.worker = startPurgeWorker({
      intervalMs: this.env.MEDIA_PURGE_INTERVAL_MINUTES * 60_000,
      log: {
        error: (details, message) => {
          const { err } = details as { err?: unknown };
          this.logger.error(`${message}: ${err instanceof Error ? err.message : String(err)}`);
        },
        info: (details, message) => this.logger.log(`${message} ${JSON.stringify(details)}`),
      },
      runPass: this.runPass,
    });
  }

  onApplicationShutdown() {
    this.worker?.stop();
  }
}

@Module({
  imports: [MediaModule],
  providers: [
    PurgeService,
    {
      provide: PURGE_PASS,
      inject: [DATABASE, REPOSITORIES, OBJECT_STORAGE, RETENTION_POLICY],
      // The database lock keeps other API instances from running the same pass concurrently.
      useFactory:
        (
          database: DatabaseHandle,
          repos: Repositories,
          storage: ObjectStorage,
          retention: RetentionPolicy,
        ): PurgePass =>
        () =>
          database.withLock("media-purge", async () => {
            const now = new Date();
            const media = await runDeletionPass(
              { audit: repos.deletionAudit, registry: repos.mediaRegistry, storage },
              now,
              retention,
            );
            const recognitionPurged = await repos.recognitionResults.deleteExpired(now);
            return { ...media, recognitionPurged };
          }),
    },
  ],
})
export class PurgeModule {}
