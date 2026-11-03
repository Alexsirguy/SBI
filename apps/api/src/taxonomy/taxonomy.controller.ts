import { Controller, Get, Inject, Query } from "@nestjs/common";
import {
  API_ROUTES,
  SupportMapRequest,
  TaxonomySearchRequest,
  type ApiRequest,
  type ApiResponse,
} from "@sbi/contracts";
import type { CoverageRepository } from "@sbi/db";
import { supportMap, type Taxonomy } from "@sbi/taxonomy";
import type { z } from "zod";
import { ZodPipe } from "../common/zod.pipe";
import { hasSafetyNotice } from "../lesson/lesson.service";
import { COVERAGE, TAXONOMY } from "../tokens";

@Controller()
export class TaxonomyController {
  constructor(
    @Inject(TAXONOMY) private readonly taxonomy: Taxonomy,
    @Inject(COVERAGE) private readonly coverage: CoverageRepository,
  ) {}

  @Get(API_ROUTES.searchTaxonomy.path)
  search(
    @Query(new ZodPipe(TaxonomySearchRequest, "Type at least 2 letters to search."))
    { q }: ApiRequest<"searchTaxonomy">,
  ): ApiResponse<"searchTaxonomy"> {
    return { results: this.taxonomy.search(q) };
  }

  @Get(API_ROUTES.supportMap.path)
  async supportMap(
    @Query(new ZodPipe(SupportMapRequest, "Name a language, such as en or es."))
    { locale }: z.output<typeof SupportMapRequest>,
  ): Promise<ApiResponse<"supportMap">> {
    const categories = supportMap(this.taxonomy, locale).map((category) => ({
      ...category,
      objects: category.objects.map((object) => ({
        ...object,
        safetyNotice: hasSafetyNotice({ id: object.id, parentId: category.id }),
      })),
    }));
    // Only counts leave the server: which subjects learners asked about stays private.
    const taught = await this.coverage.taughtBySubject();
    return {
      catalogueObjects: categories.reduce((sum, category) => sum + category.objects.length, 0),
      categories,
      onDemandSubjects: taught.filter((item) => item.taxonomyId.startsWith("subject.")).length,
    };
  }
}
