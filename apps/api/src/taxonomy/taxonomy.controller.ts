import { Controller, Get, Inject, Query } from "@nestjs/common";
import {
  API_ROUTES,
  TaxonomySearchRequest,
  type ApiRequest,
  type ApiResponse,
} from "@sbi/contracts";
import type { Taxonomy } from "@sbi/taxonomy";
import { ZodPipe } from "../common/zod.pipe";
import { TAXONOMY } from "../tokens";

@Controller()
export class TaxonomyController {
  constructor(@Inject(TAXONOMY) private readonly taxonomy: Taxonomy) {}

  @Get(API_ROUTES.searchTaxonomy.path)
  search(
    @Query(new ZodPipe(TaxonomySearchRequest, "Type at least 2 letters to search."))
    { q }: ApiRequest<"searchTaxonomy">,
  ): ApiResponse<"searchTaxonomy"> {
    return { results: this.taxonomy.search(q) };
  }
}
