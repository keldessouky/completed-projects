# Agent Context Kit

A starter kit for giving AI coding agents (GitHub Copilot running Claude models, Claude Code, and any AGENTS.md-compatible tool) the context they need to work productively in our repositories. It contains copy-paste-ready repo files, project-context templates, an authoring guide, and a rollout workflow.

**Design principle:** one source of truth per repo (`AGENTS.md`), thin tool-specific stubs pointing at it, and bulky project knowledge kept out of the always-on file and linked instead.

## What's inside

| Kit file | Copy to | Purpose |
|---|---|---|
| `repo-files/AGENTS.md` | repo root | The single source of truth. Always-on instructions for all agents. |
| `repo-files/CLAUDE.md` | repo root | Stub for Claude Code, which reads `CLAUDE.md` (not `AGENTS.md`). Imports AGENTS.md via `@AGENTS.md`. |
| `repo-files/copilot-instructions.md` | `.github/copilot-instructions.md` | Thin stub for Copilot surfaces, mirroring only the non-negotiables. |
| `repo-files/frontend.instructions.md` | `.github/instructions/` | Example path-scoped rules (applies only when working on matching files). |
| `project-context/architecture.md` | `docs/context/` | Cross-cutting system architecture (on-demand, linked from AGENTS.md). |
| `project-context/domain-glossary.md` | `docs/context/` | Business/domain vocabulary mapped to code names. |
| `project-context/adr-template.md` | `docs/context/decisions/` | Template for recording the "why" behind decisions. |
| `AUTHORING-GUIDE.md` | share with teams | How to write and test a great context file. |
| `WORKFLOW.md` | share with leads | Pilot → rollout → maintenance program, with metrics. |

## Quick start (per repo)

1. Copy the four `repo-files/` into place (see table above for destinations).
2. Ask your agent to draft repo-specific content using the generation prompt in `AUTHORING-GUIDE.md` §6.
3. Have the repo's most senior dev spend 30–60 minutes cutting the draft down and adding tribal knowledge (gotchas, boundaries, the "why").
4. Verify every command in the file actually runs, copy-paste, on a clean checkout.
5. Run the benchmark test in `WORKFLOW.md` §2 (three tasks, with vs. without the file).
6. Open a PR. Context files are code: they get reviewed, owned, and kept current.

## Repo context vs. project context

| | Repo context | Project context |
|---|---|---|
| Answers | "How do I work safely in *this* codebase?" | "What is this product/system and why is it this way?" |
| Contents | Commands, structure map, conventions, boundaries, gotchas | Architecture, domain glossary, decision records, standards, environments |
| Delivery | Auto-injected every request → must be lean | Loaded on demand via links → can be thorough |
| Changes | With the code (every relevant PR) | On product cadence (quarterly review) |
| Owner | Repo maintainers | Tech lead / architects |
| Lives in | `AGENTS.md` + stubs + `.github/instructions/` | `docs/context/` (or a shared context repo) |

Rule of thumb: if it must be true on *every* task, it's repo context. If it's needed to *understand or decide*, it's project context — link it, don't inline it.

## Target folder architecture

### Single repo
```
repo/
├── AGENTS.md                        # source of truth (lean, always-on)
├── CLAUDE.md                        # @AGENTS.md + Claude-only items
├── .github/
│   ├── copilot-instructions.md      # thin stub → AGENTS.md
│   └── instructions/
│       ├── frontend.instructions.md # applyTo: "src/web/**"
│       └── api.instructions.md      # applyTo: "src/api/**"
└── docs/context/                    # project context, on demand
    ├── architecture.md
    ├── domain-glossary.md
    └── decisions/                   # ADRs
```

### Monorepo
Root `AGENTS.md` carries only universal rules; each package gets its own nested file with its specific commands and conventions. Agents use the nearest file to where they're working.
```
monorepo/
├── AGENTS.md                        # universal: package manager, CI gates, git rules
├── CLAUDE.md                        # @AGENTS.md
├── apps/web/AGENTS.md               # web-specific commands + conventions
├── apps/api/AGENTS.md               # api-specific commands + conventions
└── packages/shared/AGENTS.md
```

### Multi-repo program (several teams, one product)
Shared knowledge lives in one place; repos receive it rather than restating it.
```
org/platform-context/                # dedicated context repo (source of truth)
├── architecture.md
├── domain-glossary.md
├── standards/  (api-design.md, security.md, ...)
└── service-catalog.md               # repo → purpose → owner → entry points

org/service-a/
├── AGENTS.md                        # links to docs/shared-context/*
└── docs/shared-context/             # synced copy, updated by scheduled bot PR
```
Why sync instead of just linking: agents work most reliably with files inside the checkout. A scheduled job (or bot PR) that copies `platform-context` into each repo's `docs/shared-context/` gives every agent local access with one editable source. Start with plain links if you want; add the sync when link-following proves unreliable for your surfaces.

## Where to go next

- Writing your repo's file → `AUTHORING-GUIDE.md`
- Running the org-wide program → `WORKFLOW.md`
