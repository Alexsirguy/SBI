# Science Behind It (SBI)

Photo-to-learning app: photograph an everyday object, confirm what it is, and explore a source-backed lesson about the science behind it.

## Quick start

Requires Node 22 (`nvm use`) and pnpm 10 (`corepack enable`).

```sh
pnpm install
pnpm dev        # web on :3000, api on :4000
pnpm test       # package tests + workspace layout checks
pnpm typecheck
pnpm build
```

## Layout

| Path | Responsibility |
|---|---|
| `apps/web` | Next.js client: capture, confirmation, lesson reader, visuals, tutor UI |
| `apps/api` | Fastify gateway; composes packages into routes |
| `packages/contracts` | Versioned schemas shared by every module |
| `packages/media` | Photo sanitisation, private storage, TTL deletion |
| `packages/recognition` | Provider-neutral recognition adapter |
| `packages/taxonomy` | Canonical categories, concepts, visual routing |
| `packages/llm` | Provider-neutral LLM adapter |
| `packages/evidence` | Sources, claim graph, citation resolution |
| `packages/orchestrator` | Lesson generation, reuse and publish gate |
| `packages/safety` | Risk classification and policy responses |
| `packages/rights` | Asset licence register and publication gate |
| `packages/visuals` | Visual registry and renderers |
| `packages/tutor` | Lesson-grounded tutor |
| `packages/analytics` | Privacy-safe analytics events |
| `packages/ui` | Shared accessible React components |
| `packages/config` | Shared TypeScript/lint configuration |

Each package exposes one public entry, `src/index.ts`. Import packages only through `@sbi/<name>`, never their internals.
