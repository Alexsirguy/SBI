import { Module } from "@nestjs/common";
import { createRateLimiter } from "../common/rate-limiter";
import type { ApiEnv } from "../env";
import { AccountModule } from "../account/account.module";
import { ClassAccessModule } from "../classes/class-access.module";
import { LessonModule } from "../lesson/lesson.module";
import { VisualsModule } from "../visuals/visuals.module";
import { API_ENV, TUTOR_LIMITER, TUTOR_STRIKES } from "../tokens";
import { createStrikeCounter } from "@sbi/tutor";
import { TutorController } from "./tutor.controller";
import { TutorService } from "./tutor.service";

@Module({
  imports: [AccountModule, ClassAccessModule, LessonModule, VisualsModule],
  controllers: [TutorController],
  providers: [
    TutorService,
    {
      provide: TUTOR_LIMITER,
      inject: [API_ENV],
      useFactory: (env: Pick<ApiEnv, "TUTOR_MAX_PER_HOUR">) =>
        createRateLimiter({ limit: env.TUTOR_MAX_PER_HOUR, windowMs: 3_600_000 }),
    },
    { provide: TUTOR_STRIKES, useFactory: () => createStrikeCounter() },
  ],
})
export class TutorModule {}
