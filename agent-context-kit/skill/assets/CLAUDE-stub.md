<!--
  destination: repo root, next to AGENTS.md

  Why this file exists: Claude Code loads CLAUDE.md, not AGENTS.md. The official
  pattern for repos standardizing on AGENTS.md is a CLAUDE.md that imports it,
  so both Copilot and Claude Code read one source of truth. (A symlink also
  works, but requires admin rights / Developer Mode on Windows — the import
  is the safer team-wide choice.)

  Keep this file thin. The @import below loads AGENTS.md at session start, and
  the combined content counts toward Claude's context — long memory files
  reduce instruction adherence. Anything useful to ALL agents belongs in
  AGENTS.md, not here.
-->

@AGENTS.md

## Claude Code specifics

<!-- Only genuinely Claude-only items below. Examples to adapt or delete: -->

- Use plan mode before changes under `src/services/payments/`.
- MCP servers and permissions are configured in `.claude/` and `.mcp.json` — don't modify them as part of feature work.
- Path-scoped rules (if any) live in `.claude/rules/` and load only when relevant files are touched.
