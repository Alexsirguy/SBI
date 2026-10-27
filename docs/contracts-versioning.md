# Contracts versioning

`@sbi/contracts` is the source of truth for shared records. Zod schemas in `packages/contracts/src` generate JSON Schema and OpenAPI components into `packages/contracts/generated`; never edit generated files by hand.

## Workflow

1. Change the Zod schema and its fixtures (`src/fixtures/<contract>/{valid,invalid}`).
2. Bump `CONTRACTS_VERSION` in `src/registry.ts` using the rules below.
3. Run `pnpm --filter @sbi/contracts generate` and commit the output. CI fails if it is stale.
4. Breaking changes: add a migration note to the PR and update every consumer in the same PR or a linked one.

## What counts as breaking

| Change                                           | Version bump                                |
| ------------------------------------------------ | ------------------------------------------- |
| Add an optional field, or a field with a default | minor                                       |
| Add a new contract                               | minor                                       |
| Add an enum value                                | minor; consumers must handle unknown values |
| Loosen validation (longer max, wider pattern)    | minor                                       |
| Docs, fixtures or messages only                  | patch                                       |
| Remove or rename a field                         | **major**                                   |
| Make an optional field required                  | **major**                                   |
| Remove an enum value or tighten validation       | **major**                                   |
| Change a field's type or meaning                 | **major**                                   |

While the version is `0.x`, breaking changes bump the minor version and must still be called out in the PR.

## Conventions

- Field names are camelCase; multi-word enum values are kebab-case.
- Timestamps are ISO 8601 with an offset; dates are `YYYY-MM-DD`.
- Generated schemas describe parsed output, so fields with defaults appear as required.
- Cross-field rules (for example "sections cite only claims in the lesson") are enforced by Zod at runtime; JSON Schema carries field-level rules only.
