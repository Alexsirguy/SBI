# 0007. Private photo storage and upload verification

- Status: accepted
- Date: 2026-10-28
- Issue: #29

## Context

Learner photos (§10, §12) must reach private storage only after type checks, metadata stripping and a malware scan. ADR 0002 put SeaweedFS behind the S3 API locally; production needs a managed bucket. Browsers upload directly to storage so photos never pass through our servers twice.

## Decision

- **Adapter.** `@sbi/media` exposes an `ObjectStorage` interface with one S3-compatible implementation on the AWS SDK. Production uses Cloudflare R2; local development and CI use SeaweedFS. Only `MEDIA_S3_*` configuration differs.
- **Staging, then promotion.** `/api/uploads` signs a PUT to `staging/<uuid>.<ext>`, valid for 5 minutes and bound to the declared `Content-Type` and `Content-Length`. It also returns an HMAC upload token for that key.
- **Confirm.** `/api/uploads/confirm` accepts only that token. It then:
  - reads the staged object, refusing anything larger than the policy limit;
  - checks magic bytes and asks ClamAV;
  - re-strips metadata and writes the result to `photos/<uuid>.<ext>`, a key no client can write to;
  - always deletes the staged object.
- **Scanning fails closed.** An infected file is rejected. A scanner error or timeout refuses the upload with 503, and the learner can retry.
- **No learner data in keys or logs.** Keys are random UUIDs plus an extension; filenames are never sent to the server.
- **Privacy is checked, not assumed.** On first use, `ensurePrivateBucket` writes a probe object and fails if an unauthenticated GET can read it.
- **CORS.** The same call limits cross-origin `PUT` to `MEDIA_UPLOAD_ORIGINS`, the app's own origins.

## Production bucket configuration (R2)

- **Encryption at rest:** R2 encrypts all objects with AES-256 by default; there is no unencrypted mode.
- **Public access:** the `r2.dev` public URL and custom domains stay disabled. These settings are not visible through the S3 API, so they are part of the launch checklist (#123).
- **Credentials:** an R2 API token scoped to this bucket with Object Read & Write only.
- **Regions:** data location follows the privacy review in #74.

## Consequences

- R2 and SeaweedFS are interchangeable, and integration tests run against SeaweedFS and ClamAV in CI.
- Uploads depend on ClamAV being reachable; it runs as a sidecar service (`clamav/clamav-debian`).
- Without sessions, the upload token is the only proof of ownership; rate limiting follows in #120.
- Orphaned staging objects (uploads never confirmed) are removed by the retention job (#30).
