import { Module } from "@nestjs/common";
import { AccountModule } from "../account/account.module";
import { createRateLimiter } from "../common/rate-limiter";
import { LessonModule } from "../lesson/lesson.module";
import { CLASS_ACTIVITY_LIMITER, CLASS_OPEN_LIMITER } from "../tokens";
import { ClassAccessModule } from "./class-access.module";
import { ClassLinkController } from "./class-link.controller";
import { ClassesController } from "./classes.controller";

@Module({
  imports: [AccountModule, ClassAccessModule, LessonModule],
  controllers: [ClassesController, ClassLinkController],
  providers: [
    {
      provide: CLASS_OPEN_LIMITER,
      useFactory: () => createRateLimiter({ limit: 120, windowMs: 60_000 }),
    },
    {
      provide: CLASS_ACTIVITY_LIMITER,
      useFactory: () => createRateLimiter({ limit: 1200, windowMs: 60_000 }),
    },
  ],
})
export class ClassesModule {}
