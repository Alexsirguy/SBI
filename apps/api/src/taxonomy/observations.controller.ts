import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { API_ROUTES, ObservationRequest, type ApiRequest } from "@sbi/contracts";
import { ZodPipe } from "../common/zod.pipe";
import { ObservationsService } from "./observations.service";

@Controller()
export class ObservationsController {
  constructor(@Inject(ObservationsService) private readonly observations: ObservationsService) {}

  @Post(API_ROUTES.noticeObject.path)
  @HttpCode(200)
  notice(
    @Body(new ZodPipe(ObservationRequest, "Tell us at least one thing you notice."))
    body: ApiRequest<"noticeObject">,
  ) {
    return this.observations.notice(body);
  }
}
