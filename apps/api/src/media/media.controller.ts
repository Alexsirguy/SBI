import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import {
  API_ROUTES,
  ConfirmUploadRequest,
  KeepPhotoRequest,
  UploadRequest,
  type ApiRequest,
} from "@sbi/contracts";
import { ZodBodyPipe } from "../common/zod-body.pipe";
import { MediaService } from "./media.service";

@Controller()
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Post(API_ROUTES.requestUpload.path)
  @HttpCode(200)
  requestUpload(
    @Body(new ZodBodyPipe(UploadRequest, "Describe the photo to upload: type and size."))
    body: ApiRequest<"requestUpload">,
  ) {
    return this.media.requestUpload(body);
  }

  @Post(API_ROUTES.confirmUpload.path)
  @HttpCode(200)
  confirmUpload(
    @Body(new ZodBodyPipe(ConfirmUploadRequest, "Unknown upload. Start the upload again."))
    body: ApiRequest<"confirmUpload">,
  ) {
    return this.media.confirmUpload(body);
  }

  @Post(API_ROUTES.keepPhoto.path)
  @HttpCode(200)
  keepPhoto(
    @Body(new ZodBodyPipe(KeepPhotoRequest, "Unknown photo.")) body: ApiRequest<"keepPhoto">,
  ) {
    return this.media.keepPhoto(body);
  }
}
