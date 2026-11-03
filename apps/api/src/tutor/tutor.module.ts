import { Module } from "@nestjs/common";
import type { Repositories } from "@sbi/db";
import { createRateLimiter } from "../common/rate-limiter";
import type { ApiEnv } from "../env";
import { LessonModule } from "../lesson/lesson.module";
import { API_ENV, REPOSITORIES, TUTOR_LIMITER, TUTOR_TURNS } from "../tokens";
import { TutorController } from "./tutor.controller";
import { TutorService } from "./tutor.service";

@Module({
  imports: [LessonModule],
  controllers: [TutorController],
  providers: [
    TutorService,
    {
      provide: TUTOR_TURNS,
      inject: [REPOSITORIES],
      useFactory: (repos: Repositories) => repos.tutorTurns,
    },
    {
      provide: TUTOR_LIMITER,
      inject: [API_ENV],
      useFactory: (env: Pick<ApiEnv, "TUTOR_MAX_PER_HOUR">) =>
        createRateLimiter({ limit: env.TUTOR_MAX_PER_HOUR, windowMs: 3_600_000 }),
    },
  ],
})
export class TutorModule {}
