import { Module } from "@nestjs/common";
import type { Repositories } from "@sbi/db";
import { REPOSITORIES, VISUAL_MANIFESTS } from "../tokens";
import { VisualsController } from "./visuals.controller";

@Module({
  controllers: [VisualsController],
  providers: [
    {
      provide: VISUAL_MANIFESTS,
      inject: [REPOSITORIES],
      useFactory: (repos: Repositories) => repos.visualManifests,
    },
  ],
  exports: [VISUAL_MANIFESTS],
})
export class VisualsModule {}
