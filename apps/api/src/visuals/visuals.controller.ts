import { Controller, Get, HttpStatus, Inject, Query } from "@nestjs/common";
import { API_ROUTES, VisualRequest, type ApiRequest, type ApiResponse } from "@sbi/contracts";
import type { VisualManifestRepository } from "@sbi/visuals";
import { UserFacingException } from "../common/user-facing.exception";
import { ZodPipe } from "../common/zod.pipe";
import { VISUAL_INTEGRITY, VISUAL_MANIFESTS } from "../tokens";
import type { SpecIntegrity } from "./integrity";

@Controller()
export class VisualsController {
  constructor(
    @Inject(VISUAL_MANIFESTS) private readonly manifests: VisualManifestRepository,
    @Inject(VISUAL_INTEGRITY) private readonly intact: SpecIntegrity,
  ) {}

  @Get(API_ROUTES.getVisual.path)
  async get(
    @Query(new ZodPipe(VisualRequest, "Name one visual by its id."))
    { visualId }: ApiRequest<"getVisual">,
  ): Promise<ApiResponse<"getVisual">> {
    const manifest = await this.manifests.get(visualId);
    if (!manifest)
      throw new UserFacingException("That visual is not available.", HttpStatus.NOT_FOUND);
    // A spec edited in the database after its check would skip every check, so it is refused.
    if (!(await this.intact(manifest))) {
      throw new UserFacingException(
        "This visual changed after it was checked.",
        HttpStatus.CONFLICT,
      );
    }
    return manifest;
  }
}
