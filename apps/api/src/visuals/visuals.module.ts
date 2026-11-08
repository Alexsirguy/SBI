import { Module } from "@nestjs/common";
import type { Repositories } from "@sbi/db";
import { REPOSITORIES, VISUAL_ASSETS, VISUAL_INTEGRITY, VISUAL_MANIFESTS } from "../tokens";
import { createSpecIntegrity } from "./integrity";
import { PlaygroundsController } from "./playgrounds.controller";
import { VisualsController } from "./visuals.controller";

@Module({
  controllers: [VisualsController, PlaygroundsController],
  providers: [
    {
      provide: VISUAL_MANIFESTS,
      inject: [REPOSITORIES],
      useFactory: (repos: Repositories) => repos.visualManifests,
    },
    {
      provide: VISUAL_ASSETS,
      inject: [REPOSITORIES],
      useFactory: (repos: Repositories) => repos.visualAssets,
    },
    {
      provide: VISUAL_INTEGRITY,
      inject: [REPOSITORIES],
      useFactory: (repos: Repositories) => createSpecIntegrity(repos.visualAssets),
    },
  ],
  exports: [VISUAL_ASSETS, VISUAL_INTEGRITY, VISUAL_MANIFESTS],
})
export class VisualsModule {}
