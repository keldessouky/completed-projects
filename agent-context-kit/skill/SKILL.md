---
name: agent-context-author
description: Generate, update, or audit AI agent context files for a repository — AGENTS.md, CLAUDE.md, .github/copilot-instructions.md, path-scoped *.instructions.md, and docs/context/ (architecture, domain glossary, ADRs) — using the org's templates and quality standards. Use this skill whenever the user asks to create or improve agent context files, onboard AI agents or new teams to a codebase, "set up this repo for Copilot/Claude", write agent instructions or onboarding docs for AI coding tools, review an existing AGENTS.md or CLAUDE.md, or mentions context files for coding agents in any form — even casually, and even if they don't name a specific file.
---

# Agent Context Author

Produces the org-standard context file set for a repository so AI coding agents (Copilot, Claude Code, and other AGENTS.md-compatible tools) work productively in it. One source of truth (`AGENTS.md`), thin tool stubs, path-scoped rules where warranted, and on-demand project context under `docs/context/`.

**Before drafting anything, read `references/authoring-standards.md` in full.** It defines the quality bar, size budgets, checklist, and reader test used below.

## Modes

Determine which applies from the user's request:

- **Create** — repo has no context files (or only auto-generated boilerplate)
- **Update** — files exist; sync them with current reality
- **Audit** — review existing files and report problems without rewriting (unless asked)

## Workflow: Create

### 1. Inventory the repo before writing a word

Read, at minimum: package manifests and lockfiles (determines the package manager — a lockfile is authoritative), CI workflow files (determines what "done" means), script definitions (package.json scripts / Makefile / justfile), test configuration, existing README and docs, and the top two directory levels. Note anything with special status: generated code, legacy areas, vendored deps.

### 2. Draft AGENTS.md

Use `assets/AGENTS-template.md` as the skeleton. It contains a worked example for a fictional service — replace every line of example content; keep the section structure (overview → stack → commands → structure → conventions → testing → git/PR → boundaries → gotchas → deeper-context links).

Rules that override any instinct to be thorough:

- Apply the one test from the standards: only non-discoverable knowledge earns a line.
- Every command must be verified against the manifests/CI you read in step 1. Never invent a command. If unverifiable, write `TODO(verify: …)`.
- Target ≤ 2 pages.

### 3. Create the stubs

- `CLAUDE.md` at repo root from `assets/CLAUDE-stub.md` — Claude Code reads CLAUDE.md, not AGENTS.md, so the `@AGENTS.md` import line is what connects Claude Code users to the source of truth. Keep it thin.
- `.github/copilot-instructions.md` from `assets/copilot-instructions-stub.md` — pointer plus the repo's 3–6 non-negotiables, mirrored verbatim from AGENTS.md.
- Path-scoped `.github/instructions/<area>.instructions.md` from `assets/path-scoped-example.instructions.md` — only where a genuinely distinct area exists (e.g. a frontend inside a backend repo). Don't create these speculatively.

### 4. Elicit the tribal knowledge (do not skip)

The inventory captures the discoverable ~60%. Ask the user up to 5 targeted questions covering what only humans know: real gotchas that have burned people, frozen/do-not-touch areas and why, ask-first boundaries, the team's definition of done, any convention that deviates from ecosystem defaults. Fold answers into AGENTS.md. If the user is unavailable, mark the Gotchas and Boundaries sections with explicit TODO items rather than inventing content.

### 5. Project context (offer, don't force)

If the conversation surfaced cross-cutting architecture or domain vocabulary, offer to scaffold `docs/context/` from `assets/architecture-template.md`, `assets/domain-glossary-template.md`, and `assets/adr-template.md`, and link them from AGENTS.md's final section. These are on-demand files: thorough is fine, inlining them into AGENTS.md is not.

### 6. Quality gate, then reader test

Run the checklist in the standards file. Then perform the reader test: answer its five onboarding questions using only the produced files. Fix any gap and re-test.

### 7. Report

Summarize: files created and their paths, all TODO(verify) items as a checklist for the human, and two adoption steps — add a PR-template line ("changed commands/structure/conventions? update AGENTS.md") and a CODEOWNERS entry for the context files.

## Workflow: Update

Diff the files against reality: re-run the step-1 inventory and compare. Fix stale commands and paths first (highest-damage staleness), then apply the one test to cut bloat, then re-run the quality gate and reader test. Preserve the human-authored gotchas/boundaries/rationale unless they're provably obsolete — that content is the hardest to recreate.

## Workflow: Audit

Produce a findings report, ordered by severity: (1) factually wrong content — commands that don't exist, paths that moved; (2) missing load-bearing sections — commands, boundaries, gotchas, definition of done; (3) bloat — lines failing the one test, with an estimated trim; (4) structural issues — missing CLAUDE.md import stub, conflicting instructions across files, secrets or sensitive URLs. End with the reader test results and a prioritized fix list. Don't rewrite unless asked.

## Boundaries for this skill

- Never fabricate commands, paths, or conventions; verify or mark TODO(verify).
- Never include secrets, tokens, or internal URLs in any produced file.
- Never restate rules a linter/formatter enforces.
- Never let AGENTS.md exceed 2 pages without explicit user sign-off.
- Preserve existing human-authored rationale during updates.
