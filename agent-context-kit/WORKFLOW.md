# Workflow: rolling out and maintaining agent context

The program plan: pilot, prove it, roll it out, keep it alive. Context files decay like any documentation — the difference is that agents *trust* them, so decay here silently degrades every AI-assisted task in the org. The maintenance loop is not optional; it's the product.

## Phase 1 — Pilot (weeks 1–2)

1. Pick 1–2 repos: actively developed, representative stack, an engaged senior dev.
2. Produce the files per `AUTHORING-GUIDE.md` (generate → curate → verify).
3. Run the benchmark protocol (below) to get before/after evidence.
4. Capture what the template got wrong or missed for this codebase.

## Phase 2 — Benchmark protocol (the credibility step)

Pick three representative tasks per pilot repo — e.g., a real bug fix, a small feature, and "add tests for module X." For each, run the same prompt in two conditions: context files present vs. temporarily removed (one branch with, one without). Score each run:

| Metric | How to score |
|---|---|
| First-try build/test pass | Did the agent's first attempt compile and pass CI checks? |
| Command accuracy | Did it use the right build/test commands without flailing? |
| Convention adherence | Count violations a reviewer would flag (naming, structure, patterns) |
| Human interventions | Number of corrective follow-up prompts needed |
| Wall-clock to acceptable | Time until a dev would approve the diff |

Also do a "reader test": ask a fresh agent session five onboarding questions ("how do I run one test file?", "where does business logic live?", "what must pass before a PR?") and check it answers correctly *from the files alone*. Wrong answers = gaps in the file, found before they cost anyone a session.

Write up the deltas in one page. This is the artifact leadership sees.

## Phase 3 — Harden the template (week 3)

Fold pilot learnings back into the kit: adjust the AGENTS.md skeleton, sharpen the generation prompt, update the checklist. Decide org standards now — file locations, ownership rules, the non-negotiables every repo mirrors into its Copilot stub — so teams don't each invent them.

## Phase 4 — Rollout (weeks 3–6)

- Each team runs the same generate → curate → verify → benchmark loop on their repos. Budget one senior-dev hour per repo; resist the temptation to ship uncurated drafts — they read like documentation and steer like nothing.
- Context files land via PR with the checklist from `AUTHORING-GUIDE.md` §7.
- Name an owner per repo in CODEOWNERS for `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.github/instructions/`.
- For multi-repo products, stand up the shared context repo + sync (see `README.md`).
- Announce in engineering channels with a 15-minute demo of a benchmark before/after.

## Phase 5 — Keep it alive (ongoing)

**On every PR:** add one checklist line to the PR template — "If this change alters build/test commands, structure, or conventions: update AGENTS.md." Reviewers enforce it like they enforce tests.

**In CI (cheap, high-value):** a small script that extracts the commands from AGENTS.md's command table and asserts each script name still exists in `package.json` / Makefile. Fails the build on drift. This catches the most damaging staleness class (wrong commands) automatically.

**Quarterly:** project-context review — owner walks `docs/context/` against reality; ADR index updated; glossary pruned. 30 minutes, calendared.

**Continuously:** a shared channel (e.g. `#ai-context`) where devs post "the agent did X wrong." Triage rule: if the same miss appears twice, it becomes a file change — one sharpened instruction at a time, retested, so cause and effect stay visible.

**Watch for drift symptoms:** agents suddenly guessing commands, violating conventions they used to follow, or asking questions the files should answer. Each is a signal a file went stale or bloated past the attention budget.

## Ownership model

| Asset | Owner | Cadence |
|---|---|---|
| Kit + org template | Platform/DevEx (you) | As learnings accumulate |
| Repo files | Repo maintainers via CODEOWNERS | Every relevant PR |
| `docs/context/` + ADRs | Tech lead / architects | Quarterly + on change |
| Shared context repo | Product-line architect | Quarterly |

## Metrics for leadership

Report quarterly, tied to the program's purpose (external teams building in our apps):

- Coverage: % of active repos with reviewed context files
- Benchmark deltas: first-try pass rate and interventions, with vs. without (from Phase 2, re-run on a sample)
- Freshness: % of repos passing the CI command check; days since last context update on active repos
- Onboarding: time-to-first-merged-PR for incoming teams, before vs. after
- Qualitative: themes from `#ai-context`

## Common failure modes to preempt

- **Checkbox compliance:** files generated, never curated. Countermeasure: the checklist + benchmark requirement.
- **The 800-line file:** someone inlines the style guide. Countermeasure: size budgets in review.
- **Silent staleness:** commands renamed, file untouched. Countermeasure: CI check + PR checklist line.
- **Fork-and-drift:** teams copy shared context and edit their copy. Countermeasure: sync is one-way; edits go upstream.
