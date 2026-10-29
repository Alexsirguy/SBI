import {
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import type { DatabaseHandle, Repositories } from "@sbi/db";
import { createDefaultRetriever } from "@sbi/evidence";
import { startIntervalWorker, type IntervalWorker } from "../common/interval-worker";
import type { ApiEnv } from "../env";
import { API_ENV, DATABASE, FRESHNESS_PASS, REPOSITORIES } from "../tokens";
import { createFreshnessPass, type FreshnessPass } from "./freshness-pass";

@Injectable()
export class FreshnessService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("EvidenceFreshness");
  private worker: IntervalWorker | null = null;

  constructor(
    @Inject(FRESHNESS_PASS) private readonly runPass: FreshnessPass,
    @Inject(API_ENV) private readonly env: Pick<ApiEnv, "EVIDENCE_RECHECK_INTERVAL_MINUTES">,
  ) {}

  onApplicationBootstrap() {
    this.worker = startIntervalWorker({
      name: "evidence freshness pass",
      intervalMs: this.env.EVIDENCE_RECHECK_INTERVAL_MINUTES * 60_000,
      runPass: this.runPass,
      summarise: ({ checked, current, errors, invalidated, lessonsMarkedStale }) => ({
        checked,
        current,
        errors,
        invalidated: invalidated.length,
        lessonsMarkedStale,
      }),
      log: {
        error: (details, message) => {
          const { err } = details as { err?: unknown };
          this.logger.error(`${message}: ${err instanceof Error ? err.message : String(err)}`);
        },
        info: (details, message) => this.logger.log(`${message} ${JSON.stringify(details)}`),
      },
    });
  }

  onApplicationShutdown() {
    this.worker?.stop();
  }
}

@Module({
  providers: [
    FreshnessService,
    {
      provide: FRESHNESS_PASS,
      inject: [DATABASE, REPOSITORIES, API_ENV],
      useFactory: (database: DatabaseHandle, repositories: Repositories, env: ApiEnv) =>
        createFreshnessPass({
          database,
          repositories,
          retriever: createDefaultRetriever(),
          maxAgeDays: env.EVIDENCE_MAX_AGE_DAYS,
          batch: env.EVIDENCE_RECHECK_BATCH,
        }),
    },
  ],
})
export class EvidenceModule {}
