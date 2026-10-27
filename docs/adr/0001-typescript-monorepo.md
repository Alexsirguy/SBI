# 0001. TypeScript monorepo with pnpm and Turborepo

- Status: accepted
- Date: 2026-10-27
- Issue: #2

## Context

The spec (§10) asks for modular service boundaries so recognition, retrieval, language models and visuals can change independently. The team wants code that stays easy for people to maintain.

## Decision

- One TypeScript codebase: Next.js for `apps/web`, Fastify for `apps/api`.
- pnpm workspaces with one package per spec layer, each exposing only `src/index.ts`.
- Turborepo runs build, lint, typecheck and test with caching.
- Node 22 LTS; exact dependency versions.
- Packages ship TypeScript source; apps bundle them (Next.js, tsup).

## Consequences

- One language and toolchain end to end; contracts are shared types, not duplicated.
- Boundaries are enforced by package `exports` and lint, not by network hops; packages can later move behind a service if scale requires it.
- Python-only ML or chemistry tooling (e.g. RDKit) will need a separate service behind an adapter.
