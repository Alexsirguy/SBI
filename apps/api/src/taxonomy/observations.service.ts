import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ApiRequest, ApiResponse } from "@sbi/contracts";
import {
  normaliseGapTerm,
  searchObservations,
  type CatalogGapRepository,
  type GapSource,
  type Taxonomy,
} from "@sbi/taxonomy";
import { CATALOG_GAPS, TAXONOMY } from "../tokens";

@Injectable()
export class ObservationsService {
  private readonly logger = new Logger(ObservationsService.name);

  constructor(
    @Inject(TAXONOMY) private readonly taxonomy: Taxonomy,
    @Inject(CATALOG_GAPS) private readonly gaps: CatalogGapRepository,
  ) {}

  async notice(request: ApiRequest<"noticeObject">): Promise<ApiResponse<"noticeObject">> {
    const notes = [request.guess, request.shape, request.material, request.use].filter(
      (note): note is string => !!note?.trim(),
    );
    const results = searchObservations(this.taxonomy, notes);
    if (results.length === 0) {
      await this.recordGap(request.guess?.trim() || notes.join(" "), "observation");
    }
    return { results };
  }

  /** Best effort: a failed write must never block the learner, and the term is never logged. */
  async recordGap(text: string, source: GapSource) {
    const term = normaliseGapTerm(text);
    if (!term) {
      return;
    }
    try {
      await this.gaps.record(term, source, new Date());
    } catch (error) {
      this.logger.warn(
        `Recording a catalog gap failed: ${error instanceof Error ? error.name : "error"}`,
      );
    }
  }
}
