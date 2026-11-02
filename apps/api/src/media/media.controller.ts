import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import {
  API_ROUTES,
  ConfirmUploadRequest,
  DeletePhotoRequest,
  KeepPhotoRequest,
  UploadRequest,
  type ApiRequest,
} from "@sbi/contracts";
import { ZodPipe } from "../common/zod.pipe";
import { MediaService } from "./media.service";

@Controller()
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Post(API_ROUTES.requestUpload.path)
  @HttpCode(200)
  requestUpload(
    @Body(new ZodPipe(UploadRequest, "Describe the photo to upload: type and size."))
    body: ApiRequest<"requestUpload">,
  ) {
    return this.media.requestUpload(body);
  }

  @Post(API_ROUTES.confirmUpload.path)
  @HttpCode(200)
  confirmUpload(
    @Body(new ZodPipe(ConfirmUploadRequest, "Unknown upload. Start the upload again."))
    body: ApiRequest<"confirmUpload">,
  ) {
    return this.media.confirmUpload(body);
  }

  @Post(API_ROUTES.keepPhoto.path)
  @HttpCode(200)
  keepPhoto(@Body(new ZodPipe(KeepPhotoRequest, "Unknown photo.")) body: ApiRequest<"keepPhoto">) {
    return this.media.keepPhoto(body);
  }

  @Post(API_ROUTES.deletePhoto.path)
  @HttpCode(200)
  deletePhoto(
    @Body(new ZodPipe(DeletePhotoRequest, "Unknown photo.")) body: ApiRequest<"deletePhoto">,
  ) {
    return this.media.deletePhoto(body);
  }
}
