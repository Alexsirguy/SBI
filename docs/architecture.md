# Architecture

Science Behind It is a TypeScript monorepo. Each layer from the product spec (§10) maps to one workspace with a single public entry, so recognition, retrieval, language models and visuals can change independently while the lesson contract stays stable.

## Request flow

```
photo → media → recognition → (user confirms) → taxonomy → orchestrator
      → evidence + llm + safety + rights → lesson (contracts) → web renders via visuals → tutor
```

If generation fails, the orchestrator returns a category-level cached lesson or a retry path, never an unvalidated answer.

## Layer map

| Spec layer            | Workspace           | Public interface (planned)                    |
| --------------------- | ------------------- | --------------------------------------------- |
| Web client            | `apps/web`          | Pages and routes                              |
| API gateway / session | `apps/api`          | HTTP routes (OpenAPI)                         |
| Contracts             | `@sbi/contracts`    | Zod schemas, generated JSON Schema/OpenAPI    |
| Media service         | `@sbi/media`        | `sanitize()`, storage adapter, TTL jobs       |
| Recognition adapter   | `@sbi/recognition`  | `RecognitionProvider`, candidate ranking      |
| Taxonomy              | `@sbi/taxonomy`     | Lookup, aliases, visual-family routing        |
| Language models       | `@sbi/llm`          | `LlmProvider`, prompt registry                |
| Evidence and content  | `@sbi/evidence`     | Source store, claim graph, citation resolver  |
| Lesson orchestrator   | `@sbi/orchestrator` | `generateLesson()`, reuse match, publish gate |
| Safety policy         | `@sbi/safety`       | Risk classification, policy responses         |
| Rights register       | `@sbi/rights`       | Asset records, publication gate               |
| Visual registry       | `@sbi/visuals`      | `VisualRenderer`, registry                    |
| Tutor                 | `@sbi/tutor`        | Grounded tutor pipeline                       |
| Analytics             | `@sbi/analytics`    | Typed events, sink adapter                    |
| Shared UI             | `@sbi/ui`           | Accessible React components                   |
| Tooling               | `@sbi/config`       | tsconfig, ESLint, Prettier                    |

## Dependency rules

1. Apps compose packages. Packages never import apps.
2. Import a package only through `@sbi/<name>`; its entry is `src/index.ts`.
3. Shared data shapes come from `@sbi/contracts`; keep cross-package calls to the documented interfaces.
4. External providers sit behind an adapter interface in the owning package.

Rules 1 and 2 are enforced by `local/no-cross-package-internals`; package `exports` maps also block deep imports at resolution time.

## Decisions

Significant decisions are recorded as ADRs in [`docs/adr`](adr). Copy `0000-template.md`, take the next number, and link the issue.
