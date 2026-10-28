import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetBucketCorsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface StoredObject {
  key: string;
  lastModified: Date;
}

export interface PresignedPut {
  key: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds: number;
}

// Storage adapter: R2 in production and SeaweedFS locally both speak the S3 API.
export interface ObjectStorage {
  presignPut(input: PresignedPut): Promise<string>;
  read(key: string, maxBytes: number): Promise<Uint8Array>;
  write(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  remove(keys: string[]): Promise<void>;
  list(prefix: string): Promise<StoredObject[]>;
  ensurePrivateBucket(): Promise<void>;
  uploadOrigins(): Promise<string[]>;
}

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  uploadOrigins: string[];
}

export class ObjectMissingError extends Error {}
export class ObjectTooLargeError extends Error {}

function status(error: unknown): number | undefined {
  return error instanceof S3ServiceException ? error.$metadata.httpStatusCode : undefined;
}

export function createS3Storage(config: S3StorageConfig): ObjectStorage {
  const client = new S3Client({
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    region: config.region,
    // Default checksums sign an empty-body CRC into presigned URLs, which then reject the real upload.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const Bucket = config.bucket;

  async function remove(keys: string[]) {
    for (let start = 0; start < keys.length; start += 1000) {
      const Objects = keys.slice(start, start + 1000).map((Key) => ({ Key }));
      await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects, Quiet: true } }));
    }
  }

  return {
    async ensurePrivateBucket() {
      try {
        await client.send(new HeadBucketCommand({ Bucket }));
      } catch (error) {
        if (status(error) !== 404) {
          throw error;
        }
        await client.send(new CreateBucketCommand({ Bucket }));
      }
      // Browsers PUT straight to the bucket, so only the app's own origins may do so.
      if (config.uploadOrigins.length > 0) {
        await client.send(
          new PutBucketCorsCommand({
            Bucket,
            CORSConfiguration: {
              CORSRules: [
                {
                  AllowedHeaders: ["content-type"],
                  AllowedMethods: ["PUT"],
                  AllowedOrigins: config.uploadOrigins,
                  MaxAgeSeconds: 3600,
                },
              ],
            },
          }),
        );
      }
      const probe = `probe/${crypto.randomUUID()}`;
      await client.send(new PutObjectCommand({ Body: "probe", Bucket, Key: probe }));
      try {
        const url = config.forcePathStyle
          ? `${config.endpoint}/${Bucket}/${probe}`
          : `${config.endpoint.replace("://", `://${Bucket}.`)}/${probe}`;
        const anonymous = await fetch(url);
        if (anonymous.ok) {
          throw new Error(`Bucket ${Bucket} allows anonymous reads; refusing to store photos.`);
        }
      } finally {
        await remove([probe]);
      }
    },

    list: async (prefix) => {
      const objects: StoredObject[] = [];
      let ContinuationToken: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({ Bucket, ContinuationToken, Prefix: prefix }),
        );
        for (const item of page.Contents ?? []) {
          if (item.Key && item.LastModified) {
            objects.push({ key: item.Key, lastModified: item.LastModified });
          }
        }
        ContinuationToken = page.NextContinuationToken;
      } while (ContinuationToken);
      return objects;
    },

    // Signing type and length stops a URL issued for a small photo carrying anything else.
    presignPut: (input) =>
      getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket,
          ContentLength: input.contentLength,
          ContentType: input.contentType,
          Key: input.key,
        }),
        {
          expiresIn: input.expiresInSeconds,
          signableHeaders: new Set(["content-length", "content-type"]),
        },
      ),

    async read(key, maxBytes) {
      let response;
      try {
        response = await client.send(new GetObjectCommand({ Bucket, Key: key }));
      } catch (error) {
        if (status(error) === 404) {
          throw new ObjectMissingError(`No object at ${key}.`);
        }
        throw error;
      }
      if ((response.ContentLength ?? 0) > maxBytes) {
        await response.Body?.transformToWebStream().cancel();
        throw new ObjectTooLargeError(`Object exceeds ${maxBytes} bytes.`);
      }
      const bytes = await response.Body?.transformToByteArray();
      if (!bytes || bytes.length > maxBytes) {
        throw new ObjectTooLargeError(`Object exceeds ${maxBytes} bytes.`);
      }
      return bytes;
    },

    remove,

    async uploadOrigins() {
      const cors = await client.send(new GetBucketCorsCommand({ Bucket }));
      return (cors.CORSRules ?? []).flatMap((rule) => rule.AllowedOrigins ?? []);
    },

    async write(key, bytes, contentType) {
      await client.send(
        new PutObjectCommand({ Body: bytes, Bucket, ContentType: contentType, Key: key }),
      );
    },
  };
}
