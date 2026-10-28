import { Module } from "@nestjs/common";
import { createTaxonomy, SEED_TAXONOMY } from "@sbi/taxonomy";
import { TAXONOMY } from "../tokens";
import { TaxonomyController } from "./taxonomy.controller";

@Module({
  controllers: [TaxonomyController],
  providers: [{ provide: TAXONOMY, useFactory: () => createTaxonomy(SEED_TAXONOMY) }],
  exports: [TAXONOMY],
})
export class TaxonomyModule {}
