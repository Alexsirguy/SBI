import { Module } from "@nestjs/common";
import type { Repositories } from "@sbi/db";
import { createClamdScanner, createS3Storage, DEFAULT_UPLOAD_POLICY } from "@sbi/media";
import type { ApiEnv } from "../env";
import {
  API_ENV,
  MALWARE_SCANNER,
  MEDIA_REGISTRY,
  OBJECT_STORAGE,
  DELETION_AUDIT,
  REPOSITORIES,
  RETENTION_POLICY,
  UPLOAD_POLICY,
} from "../tokens";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";

@Module({
  controllers: [MediaController],
  providers: [
    MediaService,
    {
      provide: OBJECT_STORAGE,
      inject: [API_ENV],
      // Startup fails unless the bucket is proven private, so uploads never land in a public one.
      useFactory: async (env: ApiEnv) => {
        const storage = createS3Storage({
          accessKeyId: env.S3_ACCESS_KEY_ID,
          bucket: env.S3_BUCKET,
          endpoint: env.S3_ENDPOINT,
          forcePathStyle: env.S3_FORCE_PATH_STYLE,
          region: env.S3_REGION,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
          uploadOrigins: env.webOrigins,
        });
        await storage.ensurePrivateBucket();
        return storage;
      },
    },
    {
      provide: MALWARE_SCANNER,
      inject: [API_ENV],
      useFactory: (env: ApiEnv) =>
        createClamdScanner({ host: env.CLAMAV_HOST, port: env.CLAMAV_PORT }),
    },
    {
      provide: MEDIA_REGISTRY,
      inject: [REPOSITORIES],
      useFactory: (repos: Repositories) => repos.mediaRegistry,
    },
    {
      provide: DELETION_AUDIT,
      inject: [REPOSITORIES],
      useFactory: (repos: Repositories) => repos.deletionAudit,
    },
    { provide: RETENTION_POLICY, inject: [API_ENV], useFactory: (env: ApiEnv) => env.retention },
    { provide: UPLOAD_POLICY, useValue: DEFAULT_UPLOAD_POLICY },
  ],
  exports: [OBJECT_STORAGE, MEDIA_REGISTRY, DELETION_AUDIT, RETENTION_POLICY, UPLOAD_POLICY],
})
export class MediaModule {}
