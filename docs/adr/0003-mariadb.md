# 0003. MariaDB as the primary database

- Status: accepted
- Date: 2026-10-27
- Issue: #7

## Context

The API stores lessons, claims, sources, asset rights records, recognition results and tutor turns (§11). The team prefers MariaDB over Postgres.

## Decision

Use MariaDB 11.8 LTS. Local development runs it from `docker-compose.yml`; the connection string is `DATABASE_URL` (`mysql://` scheme).

## Consequences

- MariaDB `JSON` is validated text, not an indexed binary type; query JSON fields through generated columns with indexes rather than ad-hoc JSON scans.
- Native `VECTOR` columns (11.7+) are available for evidence retrieval.
- Migration tooling and the driver must support MariaDB; decided in the persistence ticket (#23).
