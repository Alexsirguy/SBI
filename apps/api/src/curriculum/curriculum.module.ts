import { Module } from "@nestjs/common";
import type { Repositories } from "@sbi/db";
import { CURRICULUM, REPOSITORIES } from "../tokens";
import { CurriculumController } from "./curriculum.controller";

@Module({
  controllers: [CurriculumController],
  providers: [
    {
      provide: CURRICULUM,
      inject: [REPOSITORIES],
      useFactory: (repos: Repositories) => repos.curriculum,
    },
  ],
  exports: [CURRICULUM],
})
export class CurriculumModule {}
