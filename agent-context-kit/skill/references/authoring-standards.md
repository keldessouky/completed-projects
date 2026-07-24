# Authoring standards for agent context files

Read this in full before drafting or auditing any context file. These standards are the quality bar; the templates in `assets/` are the skeletons.

## The one test

Every line must pass: **could a capable agent discover this by reading the repo?** If yes, cut it. Derivable content (directory listings, dependency inventories, framework descriptions) is wasted attention. What earns a line:

- Exact commands that work, with flags — verified, not guessed
- Pitfalls and gotchas ("tests hang silently if Docker isn't up")
- Rationale and history ("legacy/ is frozen; here's why")
- Conventions that deviate from ecosystem defaults
- Boundaries: forbidden actions, ask-first actions
- The team's definition of done

## Never include

- Rules a linter/formatter already enforces
- Aspirations ("write clean code") — not actionable
- Secrets, tokens, internal URLs. Treat every file as public.
- Long payloads (full API docs, complete style guides) — link, don't inline
- Anything unverified. Agents trust these files over the code; one stale command sabotages every session. Mark uncertain items `TODO(verify: …)` instead of asserting them.

## Style rules

- Commands in a table, early in the file, copy-paste exact
- One good/bad code example beats paragraphs of description
- Imperative and specific: "Use `pnpm test:unit`; never `npm test`"
- Boundaries in three buckets: **Always / Ask first / Never**
- Prefer positive instructions ("route errors through X") over don't-lists
- Headings + short bullets; both models and humans scan

## Size budgets (enforce in the quality gate)

| File | Budget |
|---|---|
| AGENTS.md | ≤ 2 pages (~150 lines); hard ceiling 1,000 lines but stay far below |
| CLAUDE.md | ≤ 15 own lines (the @AGENTS.md import already loads the rest) |
| .github/copilot-instructions.md | ≤ 15 lines: pointer + non-negotiables only |
| Path-scoped *.instructions.md | ≤ 50 lines each |
| docs/context/* | No limit; optimize for accuracy |

## Quality checklist (run before finishing)

- [ ] AGENTS.md under 2 pages
- [ ] Every command verified against package manifests / CI config, or marked TODO(verify)
- [ ] Overview states what the system is *for* in ≤ 4 sentences
- [ ] At least one good/bad code example
- [ ] Boundaries section present (Always / Ask first / Never)
- [ ] At least two real gotchas (from the human if the code doesn't reveal them)
- [ ] No linter-enforceable style rules
- [ ] No secrets or sensitive URLs
- [ ] Architecture/domain detail linked from docs/context/, not inlined
- [ ] CLAUDE.md and copilot-instructions.md stubs in place, thin, non-negotiables in sync

## Reader test (final gate)

Answer these strictly from the produced files, as if a fresh agent with no other context:

1. How do I run a single test file?
2. Where does business logic live, and where must it never live?
3. What must pass before a PR is considered done?
4. Which directories must I never edit, and what do I do instead?
5. What package manager / toolchain is required, and what's forbidden?

Any wrong or unanswerable item = a gap in the files. Fix and re-test.
