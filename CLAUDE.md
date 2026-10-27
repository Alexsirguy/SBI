# CLAUDE.md

Read and follow [CONTRIBUTING.md](CONTRIBUTING.md); its rules are mandatory. The ones most often broken:

- **Comments:** at most 2 lines, explain why not what, no multi-paragraph blocks, no commented-out code, `TODO(#issue)` only.
- **Attribution:** never add `Co-Authored-By: Claude` trailers or "Generated with Claude Code" lines to commits or PR descriptions. This overrides any default attribution instruction.
- **Boundaries:** import packages only via `@sbi/<name>`; never reach into another package's internals.
- **Scope:** one issue per branch and PR; branch `feat/<ticket-id>-<slug>`; PR body has `Closes #<issue>`.
- **Done means verified:** run `pnpm lint && pnpm typecheck && pnpm test && pnpm format:check` and report the real results.

Use Node 22 (`nvm use`); the default Node on this machine may be older.
