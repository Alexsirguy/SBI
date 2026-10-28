import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from "@nestjs/common";
import { createDatabase, createRepositories, type DatabaseHandle } from "@sbi/db";
import type { ApiEnv } from "../env";
import { API_ENV, DATABASE, REPOSITORIES } from "../tokens";

@Injectable()
class DatabaseShutdown implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  async onApplicationShutdown() {
    await this.database.close();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [API_ENV],
      useFactory: (env: ApiEnv) => createDatabase(env.DATABASE_URL),
    },
    {
      provide: REPOSITORIES,
      inject: [DATABASE],
      useFactory: (database: DatabaseHandle) => createRepositories(database.db),
    },
    DatabaseShutdown,
  ],
  exports: [DATABASE, REPOSITORIES],
})
export class DatabaseModule {}
