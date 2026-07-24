<!--
  destination: .github/copilot-instructions.md

  Why this file exists: Copilot reads AGENTS.md natively, but this repo-wide
  file has the broadest coverage across Copilot surfaces (chat, coding agent,
  code review) and is weighted when layers conflict. Keep it a thin stub:
  both files are injected, so duplication wastes context, and conflicting
  instructions across files resolve unpredictably.

  Mirror ONLY the short list of non-negotiables — the rules you want applied
  even on surfaces that don't reliably follow links (e.g. code review).
  If you change these, change AGENTS.md too. One source of truth, one echo.
-->

This repository's full agent instructions live in [AGENTS.md](../AGENTS.md) at the repo root. Follow them.

Non-negotiables (mirrored from AGENTS.md):

- pnpm only — never npm or yarn.
- Never edit `src/generated/`; regenerate with `pnpm codegen`.
- Never commit secrets or `.env` files; config comes from env vars via `src/config.ts`.
- New or changed endpoints require unit tests and an `openapi.yaml` update in the same PR.
- Never delete failing tests to make CI pass.
