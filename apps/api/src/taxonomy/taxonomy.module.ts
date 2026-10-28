import { Module } from "@nestjs/common";
import type { Repositories } from "@sbi/db";
import { createTaxonomy, SEED_TAXONOMY } from "@sbi/taxonomy";
import { CATALOG_GAPS, REPOSITORIES, TAXONOMY } from "../tokens";
import { ObservationsController } from "./observations.controller";
import { ObservationsService } from "./observations.service";
import { TaxonomyController } from "./taxonomy.controller";

@Module({
  controllers: [ObservationsController, TaxonomyController],
  providers: [
    ObservationsService,
    { provide: TAXONOMY, useFactory: () => createTaxonomy(SEED_TAXONOMY) },
    {
      provide: CATALOG_GAPS,
      inject: [REPOSITORIES],
      useFactory: (repos: Repositories) => repos.catalogGaps,
    },
  ],
  exports: [ObservationsService, TAXONOMY],
})
export class TaxonomyModule {}
