# Authoring Guide: writing context files that actually work

For the team member writing or reviewing a repo's `AGENTS.md` and related files. Budget: 30–60 minutes of senior-dev time per repo. That hour is where all the value is.

## 1. The one test every line must pass

**Could a capable agent discover this by reading the repo?** If yes, cut it. Agents read code fast and free; directory listings, dependency inventories, and framework descriptions are wasted tokens. What they cannot discover — and what earns a line — is:

- Exact commands that work (vs. the three plausible ones that don't)
- Pitfalls and gotchas ("tests hang silently if Docker isn't up")
- Rationale and history ("legacy/ is frozen; here's why")
- Conventions that differ from ecosystem defaults
- Boundaries: what's forbidden, what needs a human first
- What "done" means on this team

This mirrors how Anthropic's own tooling trims Claude memory files: it cuts derivable content (layouts, dependency lists, architecture overviews) and keeps pitfalls, rationale, and deviations from defaults.

## 2. Never include

- Rules a linter/formatter already enforces (tooling beats prose; let CI do it)
- Aspirations ("write clean, maintainable code") — agents can't act on them
- Secrets, tokens, or internal URLs you'd mind leaking. Treat the file as public.
- Long payloads (full API docs, complete style guides) — link them instead
- Anything you aren't certain is currently true. Agents trust the file over the code; a stale command sabotages every session.

## 3. Style rules that measurably matter

- **Commands early, exact, with flags.** A table near the top. Agents reference it constantly, and a guessed-wrong build command can burn an entire session.
- **One real code example beats three paragraphs.** Good/bad pairs are the densest instruction format there is.
- **Imperative and specific.** "Use `pnpm test:unit`; never `npm test`" — not "we generally prefer pnpm."
- **Boundaries in three buckets:** Always / Ask first / Never.
- **Positive instructions where possible.** "Route errors through `src/errors.ts`" steers better than a list of ten don'ts.
- **Headings + short bullets**, so both models and humans can scan.

## 4. Size budgets

| File | Budget | Why |
|---|---|---|
| `AGENTS.md` | ≤ 2 pages (~150 lines) | Injected on every request; long files dilute adherence. Hard ceiling before quality degrades: ~1,000 lines. Stay far below it. |
| `CLAUDE.md` | ≤ 15 lines of its own | The `@AGENTS.md` import already loads everything; combined size counts against adherence (aim under ~200 lines total loaded). |
| `.github/copilot-instructions.md` | ≤ 15 lines | Stub + non-negotiables only. |
| Path-scoped `*.instructions.md` | ≤ 50 lines each | Scoped is only useful if it stays sharp. |
| `docs/context/*` | No hard limit | On-demand. Optimize for accuracy, not brevity. |

## 5. The process

1. **Generate a draft** with the prompt in §6 — run it in Copilot chat or Claude Code from inside the repo.
2. **Curate ruthlessly** (senior dev, 30–60 min): delete everything failing the §1 test, then add what only humans know — gotchas, boundaries, rationale, definition of done.
3. **Verify the commands.** Clean checkout, copy-paste each one. No exceptions.
4. **Benchmark it.** Run the three-task test in `WORKFLOW.md` §2. If an instruction was ignored, sharpen that one instruction and rerun — refine one at a time so you can tell what worked.
5. **PR it.** Reviewed like code, owned like code.

## 6. Draft-generation prompt

Paste into your agent from the repo root:

```text
Analyze this repository and draft an AGENTS.md for AI coding agents. You will
do this once and many agents will rely on it, so investigate thoroughly before
writing: package manifests, CI workflows, existing docs, test setup.

Constraints:
- Maximum 2 pages. Every line must earn its place.
- Include ONLY what an agent could not infer by reading the code: exact
  build/test/lint commands with flags (verify them against package.json and CI
  config), non-obvious conventions, directories with special status
  (generated, legacy, do-not-touch), and the checks CI requires to pass.
- Do NOT include: directory listings, dependency inventories, framework
  tutorials, or generic best practices.
- Structure: overview (3 sentences) → tech stack → commands table →
  where things live (annotated, only the notable paths) → conventions with one
  good/bad code example each → testing expectations → git/PR conventions →
  boundaries (Always / Ask first / Never) → gotchas.
- Mark anything you could not verify with TODO(verify) instead of guessing.
```

The draft handles the discoverable 60%. Your job is deleting its filler and adding the tribal 40% it cannot know.

## 7. Quality checklist (PR reviewers: check these)

- [ ] Under 2 pages
- [ ] Every command verified on a clean checkout
- [ ] Overview says what the system is *for*, in ≤ 4 sentences
- [ ] Contains at least one good/bad code example
- [ ] Boundaries section present (Always / Ask first / Never)
- [ ] At least two real gotchas (if you can't think of any, ask the on-call)
- [ ] No linter-enforceable style rules
- [ ] No secrets, tokens, or sensitive URLs
- [ ] Links to `docs/context/` instead of inlining architecture/domain detail
- [ ] `CLAUDE.md` and `.github/copilot-instructions.md` stubs in place and thin
- [ ] Owner named in CODEOWNERS for these files

## 8. Further reading

- AGENTS.md standard: https://agents.md
- GitHub — write great agents.md (2,500-repo analysis): https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/
- GitHub — custom instructions concepts: https://docs.github.com/en/copilot/concepts/prompting/response-customization
- Claude Code memory & CLAUDE.md: https://code.claude.com/docs/en/memory
