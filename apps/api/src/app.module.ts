import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { ApiErrorFilter } from "./common/api-error.filter";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { MediaModule } from "./media/media.module";
import { PurgeModule } from "./purge/purge.module";

@Module({
  imports: [ConfigModule, DatabaseModule, MediaModule, PurgeModule],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: ApiErrorFilter }],
})
export class AppModule {}

// Shared by the server and tests so both run with the same HTTP behaviour.
export function configureApp(app: NestFastifyApplication, webOrigins: string[]) {
  app.enableCors({ methods: ["GET", "POST"], origin: webOrigins });
  return app;
}
