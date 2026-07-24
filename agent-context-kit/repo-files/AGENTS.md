<!--
  AGENTS.md — the single source of truth for AI coding agents in this repo.
  Read by: GitHub Copilot (chat, coding agent, code review), Claude Code (via the
  CLAUDE.md import), Cursor, and most AGENTS.md-compatible tools.

  Rules for editing this file:
  • Keep it under ~2 pages. It is injected into every agent request; every line
    competes for the model's attention with the actual task.
  • Only include what an agent CANNOT discover by reading the code. Directory
    listings and dependency lists it can derive; pitfalls, rationale, and
    deviations from defaults it cannot.
  • Commands must be copy-paste exact. A wrong command is worse than no command.
  • If a linter or formatter enforces a rule, do not restate it here.

  Everything below is a WORKED EXAMPLE for a fictional service ("OrderHub").
  Replace all content with your repo's reality. Keep the section skeleton.
-->

# OrderHub — Agent Instructions

OrderHub is Acme's order-management service. It owns the order lifecycle (create → pay → fulfil → refund) and exposes a REST API consumed by the web and mobile apps. It processes ~40k orders/day in production, so correctness around payments and idempotency matters more than speed of delivery.

## Tech stack

- TypeScript 5 on Node 22, Fastify 5
- PostgreSQL 16 via Drizzle ORM; Redis + BullMQ for background jobs
- **pnpm only.** Never npm or yarn — they corrupt the lockfile.
- Vitest (unit), Playwright (e2e)

## Commands

| Task | Command |
|---|---|
| Install | `pnpm install --frozen-lockfile` |
| Start deps | `docker compose up -d db redis` |
| Dev server | `pnpm dev` (requires deps running; serves on :4000) |
| Unit tests | `pnpm test:unit` |
| One test file | `pnpm vitest run src/orders/order.service.test.ts` |
| E2E tests | `pnpm test:e2e` (spins up own containers; ~4 min — don't run for small changes) |
| Lint + autofix | `pnpm lint --fix` |
| Typecheck | `pnpm typecheck` |
| New migration | `pnpm db:generate` then `pnpm db:migrate` |

**Definition of done:** `pnpm lint`, `pnpm typecheck`, and `pnpm test:unit` all green. CI enforces all three; run them before declaring a task complete.

## Where things live

- `src/api/` — Fastify route handlers. Thin: validate, call a service, map the response.
- `src/services/` — business logic. All rules live here, never in routes.
- `src/db/schema/` — Drizzle schema. Changing it requires a migration (see Commands).
- `src/generated/` — **never edit.** Regenerate with `pnpm codegen`.
- `src/legacy/checkout/` — frozen for deletion. Fix bugs only; never extend. New checkout work goes in `src/services/checkout/`.
- `tests/e2e/` — Playwright specs, one file per user journey.

## Conventions (the non-obvious ones)

Errors: services throw typed errors from `src/errors.ts`; routes never build error responses by hand.

```ts
// Good
throw new NotFoundError("order", orderId);

// Bad — bypasses the error middleware and breaks API error contracts
return reply.status(404).send({ error: "not found" });
```

Database access: only services touch the DB, and always through the repository layer in `src/db/repos/`. No inline queries in routes or jobs.

Money is always integer cents (`amountCents: number`). Never floats, never a `price` field without units.

API changes: any new/changed endpoint needs a matching update in `docs/api/openapi.yaml` in the same PR.

## Testing

- Every service function gets unit tests next to it (`*.test.ts`). Cover the failure paths, not just the happy path.
- Use the builders in `tests/factories/` for test data; don't hand-roll entities.
- Never mock the repository layer in service tests — use the test DB (`pnpm test:unit` starts it automatically).

## Git & PRs

- Branches: `feat/…`, `fix/…`, `chore/…`
- Conventional Commits (`feat:`, `fix:`, …) — release notes are generated from them.
- PRs stay under ~400 changed lines where possible; split otherwise.

## Boundaries

**Always:** run the Definition of done before finishing · keep changes scoped to the task · update docs touched by your change.

**Ask first:** adding a dependency · changing anything in `src/db/schema/` · touching payment code in `src/services/payments/` · modifying CI workflows.

**Never:** edit `src/generated/` · commit secrets or `.env` files (config comes from env vars via `src/config.ts`) · force-push shared branches · delete failing tests to make CI pass.

## Gotchas

- Integration-ish unit tests hang silently if Docker deps aren't up. Run `docker compose up -d db redis` first.
- `pnpm dev` won't pick up schema changes — restart it after running migrations.
- The Stripe webhook handler must stay idempotent; duplicate webhook deliveries happen in production. See `docs/context/decisions/0007-idempotent-webhooks.md`.

## Deeper context (read when relevant, not preloaded)

- System architecture & data flow: `docs/context/architecture.md`
- Domain vocabulary (use these exact terms in code): `docs/context/domain-glossary.md`
- Why things are the way they are (ADRs): `docs/context/decisions/`
