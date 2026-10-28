# 0008. NestJS on Fastify for the API

- Status: accepted
- Date: 2026-10-28
- Issue: #29

## Context

ADR 0001 chose Fastify for `apps/api`. The first media routes were written as Next.js route handlers, so the web app held storage, scanner and database credentials, and the browser called them with untyped `fetch`. The API needs one structure that every feature follows as recognition, lessons and the tutor arrive, and Fastify's throughput should stay.

## Decision

- **NestJS 12 with `@nestjs/platform-fastify`.** Nest gives modules, providers and controllers; Fastify still serves HTTP. Express is not used.
- **One module per feature** (`media`, `purge`), plus global `config` and `database` modules. Controllers stay thin; services hold the logic.
- **Explicit injection tokens** (`src/tokens.ts`). Our esbuild-based toolchain (tsx, tsup, Vitest) emits no decorator metadata, so every constructor parameter uses `@Inject(TOKEN)`.
- **Contracts drive validation.** `API_ROUTES` in `@sbi/contracts` names each route's path and its Zod request and response schemas. `ZodBodyPipe` validates bodies, the OpenAPI document is generated from the same table, and the web client checks replies against it.
- **One error shape.** `ApiErrorFilter` sends `{ error }` for every failure. Only a `UserFacingException` message reaches clients, because framework errors can quote the request body back.
- **The web app holds no server secrets.** It calls the API through `createApiClient` and react-query mutations.

## Consequences

- New endpoints are a contract entry, a controller method and a service; tests override providers in `Test.createTestingModule`.
- Startup fails fast when env is invalid or the bucket is not private, because providers resolve before the server listens.
- Decorators need `experimentalDecorators` in `apps/api/tsconfig.json`. Adopting decorator metadata would need an SWC build.
