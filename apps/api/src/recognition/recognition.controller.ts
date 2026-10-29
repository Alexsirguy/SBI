import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import {
  API_ROUTES,
  RecognisePhotoRequest,
  RecordSelectionRequest,
  type ApiRequest,
} from "@sbi/contracts";
import { ZodPipe } from "../common/zod.pipe";
import { RecognitionService } from "./recognition.service";

@Controller()
export class RecognitionController {
  constructor(@Inject(RecognitionService) private readonly recognition: RecognitionService) {}

  @Post(API_ROUTES.recognisePhoto.path)
  @HttpCode(200)
  recognise(
    @Body(new ZodPipe(RecognisePhotoRequest, "Unknown photo.")) body: ApiRequest<"recognisePhoto">,
  ) {
    return this.recognition.recognise(body);
  }

  @Post(API_ROUTES.recordSelection.path)
  @HttpCode(200)
  recordSelection(
    @Body(new ZodPipe(RecordSelectionRequest, "Choose an object or describe it in a few words."))
    body: ApiRequest<"recordSelection">,
  ) {
    return this.recognition.recordSelection(body);
  }
}
