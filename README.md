# Science Behind It (SBI)

Photo-to-learning app: photograph an everyday object, confirm what it is, and explore a source-backed lesson about the science behind it.

## Quick start

Requires Node 22 (`nvm use`), pnpm 10 (`corepack enable`) and Docker.

```sh
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp packages/db/.env.example packages/db/.env
docker compose up -d   # MariaDB :3306, S3-compatible storage :8333
pnpm db:migrate
pnpm dev               # web :3000, api :4000
```

Check everything before pushing:

```sh
pnpm lint && pnpm typecheck && pnpm test && pnpm format:check
pnpm test:e2e   # first run: pnpm --filter @sbi/web exec playwright install chromium
```

Feature flags are comma lists in `FEATURE_FLAGS` (api) and `NEXT_PUBLIC_FEATURE_FLAGS` (web), e.g. `tutor,!photoRecognition`. Defaults live in `@sbi/env`.

## Layout

| Path                    | Responsibility                                                          |
| ----------------------- | ----------------------------------------------------------------------- |
| `apps/web`              | Next.js client: capture, confirmation, lesson reader, visuals, tutor UI |
| `apps/api`              | NestJS gateway on Fastify; composes packages into routes                |
| `packages/contracts`    | Versioned schemas shared by every module                                |
| `packages/media`        | Photo sanitisation, private storage, TTL deletion                       |
| `packages/recognition`  | Provider-neutral recognition adapter                                    |
| `packages/taxonomy`     | Canonical categories, concepts, visual routing                          |
| `packages/llm`          | Provider-neutral LLM adapter                                            |
| `packages/evidence`     | Sources, claim graph, citation resolution                               |
| `packages/orchestrator` | Lesson generation, reuse and publish gate                               |
| `packages/safety`       | Risk classification and policy responses                                |
| `packages/rights`       | Asset licence register and publication gate                             |
| `packages/visuals`      | Visual registry and renderers                                           |
| `packages/tutor`        | Lesson-grounded tutor                                                   |
| `packages/analytics`    | Privacy-safe analytics events                                           |
| `packages/benchmark`    | Research seed set, vendor benchmark and feasibility spikes              |
| `packages/ui`           | Shared accessible React components                                      |
| `packages/db`           | MariaDB persistence: schema, migrations, repository implementations     |
| `packages/env`          | Typed environment loading and feature flags                             |
| `packages/testing`      | Shared test utilities and contract fixture validation                   |
| `packages/config`       | Shared TypeScript/lint configuration                                    |

Each package exposes one public entry, `src/index.ts`. Import packages only through `@sbi/<name>`, never their internals.
