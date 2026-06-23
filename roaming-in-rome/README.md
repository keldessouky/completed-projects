# Roaming in Rome

A travel app for browsing Rome's landmarks and building personal itineraries.

This is a modern TypeScript rewrite of an original team capstone (Spring Boot +
JdbcTemplate + Vue 2). The rewrite keeps every feature while fixing the security
and correctness defects in the original. See [`REWRITE-PLAN.md`](./REWRITE-PLAN.md)
for the full migration plan and the original under
[`team-golf-java-green-final-capstone/`](./team-golf-java-green-final-capstone)
for reference.

## Stack

| Layer    | Tech |
|----------|------|
| API      | NestJS 10, Prisma 5, PostgreSQL, Passport-JWT, bcrypt, class-validator |
| Web      | React 18, Vite 5, TypeScript, React Router 6, Redux Toolkit, axios |
| Tests    | Jest + supertest (API), Vitest + React Testing Library (web) |

```
roaming-in-rome/
├── server/   # NestJS + Prisma API
├── web/      # React + TypeScript client
└── team-golf-java-green-final-capstone/   # original app (reference)
```

## What the rewrite fixes

The original app had several issues (see `REWRITE-PLAN.md` §5). The rewrite
addresses them by construction:

- **Authentication is enforced.** A global `JwtAuthGuard` protects every route;
  only routes marked `@Public()` (landmark browsing, register, login) are open.
- **No more IDOR.** Every itinerary operation is scoped to the user id taken
  from the verified JWT — never from a URL or request body. Reading or mutating
  another user's itinerary returns 403.
- **No privilege escalation.** Registration always assigns `ROLE_USER`; the
  request body cannot set a role (and unknown fields are rejected).
- **Clean error handling.** A missing landmark returns 404, not a 500.
- **Secrets via env.** `DATABASE_URL` and `JWT_SECRET` come from `.env`
  (gitignored); an `.env.example` documents them. CORS is restricted to the web
  origin, and Helmet + request validation are enabled.

## Quick start with Docker

The fastest way to run the whole stack (Postgres + API + web):

```bash
docker compose up --build
# open http://localhost:8080
```

The API container applies migrations and seeds the demo data on start. To run
without the seed, set `SEED_ON_START=false` for the `api` service.

## Prerequisites (for running without Docker)

- Node.js 20+ and npm (see `.nvmrc`)
- PostgreSQL 14+

## Running locally

### 1. API (`server/`)

```bash
cd server
cp .env.example .env          # then edit DATABASE_URL / JWT_SECRET
npm install
npx prisma migrate deploy     # create the schema
npm run db:seed               # load demo landmarks + accounts
npm run start:dev             # http://localhost:3000
```

### 2. Web (`web/`)

```bash
cd web
npm install
npm run dev                   # http://localhost:5173
```

The Vite dev server proxies `/api/*` to the API at `http://localhost:3000`, so
no CORS configuration is needed for local development.

### Demo accounts

Both seeded accounts use the password `password`:

| Username | Role        |
|----------|-------------|
| `user`   | ROLE_USER   |
| `admin`  | ROLE_ADMIN  |

## API overview

| Method & path | Auth | Description |
|---|---|---|
| `GET /health` | public | Liveness + DB readiness probe |
| `POST /auth/register` | public | Create an account (role forced to ROLE_USER) |
| `POST /auth/login` | public | Returns `{ token, user }` |
| `GET /landmarks` | public | List landmarks |
| `GET /landmarks/:id` | public | Landmark detail (404 if missing) |
| `POST /landmarks` | admin | Create a landmark |
| `GET /itineraries` | user | The caller's itineraries |
| `POST /itineraries` | user | Create an itinerary |
| `DELETE /itineraries/:id` | user (owner) | Delete an itinerary |
| `GET /itineraries/:id/landmarks` | user (owner) | Landmarks in an itinerary |
| `POST /itineraries/:id/landmarks` | user (owner) | Add a landmark |
| `DELETE /itineraries/:id/landmarks/:landmarkId` | user (owner) | Remove a landmark |

## Tests & linting

```bash
# API
cd server
npm run lint                  # ESLint + Prettier
npm test                      # unit tests (mocked Prisma)
npm run test:e2e              # e2e against a test database (auto-migrates first)

# Web
cd web
npm run lint                  # ESLint
npm test                      # Vitest unit + component tests
```

The API e2e suite expects a `roaming_in_rome_test` database; it defaults to the
local connection in `test/setup-e2e.ts` and honors `DATABASE_URL` if set. The
`pretest:e2e` script runs `prisma migrate deploy` against it automatically.

## Continuous integration

`.github/workflows/ci.yml` runs lint + build + tests for both packages on every
push and pull request, spinning up a Postgres service container for the API's
e2e suite.
