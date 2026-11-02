import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { AccountModule } from "./account/account.module";
import { ApiErrorFilter } from "./common/api-error.filter";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { EvidenceModule } from "./evidence/evidence.module";
import { HealthController } from "./health/health.controller";
import { LessonModule } from "./lesson/lesson.module";
import { MediaModule } from "./media/media.module";
import { PurgeModule } from "./purge/purge.module";
import { RecognitionModule } from "./recognition/recognition.module";
import { TaxonomyModule } from "./taxonomy/taxonomy.module";
import { VisualsModule } from "./visuals/visuals.module";

@Module({
  imports: [
    AccountModule,
    ConfigModule,
    DatabaseModule,
    EvidenceModule,
    LessonModule,
    MediaModule,
    PurgeModule,
    RecognitionModule,
    TaxonomyModule,
    VisualsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: ApiErrorFilter }],
})
export class AppModule {}

// Shared by the server and tests so both run with the same HTTP behaviour.
export function configureApp(app: NestFastifyApplication, webOrigins: string[]) {
  // Credentials let our web app send the session cookie; only listed origins may.
  app.enableCors({ credentials: true, methods: ["GET", "POST"], origin: webOrigins });
  return app;
}
