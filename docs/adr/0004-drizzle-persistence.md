# 0004. Drizzle for MariaDB persistence

- Status: accepted
- Date: 2026-10-27
- Issue: #23

## Context

Lessons, evidence, asset rights, recognition results and tutor turns need durable storage in MariaDB (ADR-0003). Modules must stay swappable, and SQL should live in one place.

## Decision

- Drizzle ORM with the `mysql2` driver and `drizzle-kit` migrations, in a dedicated `@sbi/db` package.
- Each owning package defines its repository interface (e.g. `LessonRepository` in `@sbi/orchestrator`); `@sbi/db` implements them. No other package imports Drizzle or writes SQL.
- Each table stores the full contract record as a JSON `document` plus indexed scalar columns for lookups. Documents are validated with the Zod contract on write and on read.
- Primary keys are app-generated UUIDv7 values in MariaDB's native `UUID` column: unguessable, safe to expose, known before insert, and time-ordered so inserts append to the index.

## Consequences

- Contracts can gain fields without a migration; new lookup columns still need one.
- MariaDB is not MySQL: its `UUID` type and text-backed `JSON` need small custom Drizzle column types, and Drizzle's `serial()` emits SQL MariaDB rejects. Integration tests run against real MariaDB to catch these differences.
- Swapping the database later means a new implementation of the repository interfaces, not changes in domain packages.
