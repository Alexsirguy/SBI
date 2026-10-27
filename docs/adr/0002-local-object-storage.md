# 0002. SeaweedFS for local S3-compatible storage

- Status: accepted
- Date: 2026-10-27
- Issue: #7

## Context

The media service (§10) stores photos in private S3-compatible object storage. Local development needs the same API. MinIO no longer publishes community Docker images.

## Decision

Use SeaweedFS (Apache-2.0) with its S3 gateway in `docker-compose.yml` for local development. Production storage is chosen separately; code talks only to the S3 API through the media package's storage adapter.

## Consequences

- Local and production storage share one S3 interface.
- SeaweedFS does not create buckets on startup; the media storage adapter must ensure its bucket exists (#29).
