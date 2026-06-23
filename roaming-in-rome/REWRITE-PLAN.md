# Roaming in Rome — Full-Stack Rewrite Plan (NestJS + Prisma + React/TS)

This document is the migration plan for porting the original capstone
(Spring Boot + JdbcTemplate + Vue 2) to a modern TypeScript stack
(NestJS + Prisma API, React + TypeScript web). It captures
the target architecture, an endpoint-by-endpoint map, the data model, the
security fixes baked into the redesign, and a phased milestone breakdown.

> Source of truth for behavior is the existing app under
> `team-golf-java-green-final-capstone/`. The rewrite preserves every feature
> while fixing the defects called out in the review.

---

## 1. Goals

1. **Feature parity** with the original: landmark browsing (images, maps,
   descriptions), user registration/login, and per-user itineraries
   (create, delete, add/remove landmarks).
2. **Fix the security model by construction** — auth enforced on every
   protected route, user identity taken from the JWT (not the URL/body),
   no client-controlled roles, no committed secrets.
3. **Type safety end to end** — Prisma models on the server, typed API client
   on the web, shared DTO/types where practical.
4. **Real tests** — unit + e2e on the backend, component/e2e on the frontend.

## 2. Target architecture

```
roaming-in-rome/
├── server/                 # NestJS + Prisma API
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts         # ports database.sql seed data
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── prisma/         # PrismaModule + PrismaService
│   │   ├── auth/           # controller, service, JWT strategy, guards, DTOs
│   │   ├── users/          # service + repository
│   │   ├── landmarks/      # controller, service, DTOs
│   │   └── itineraries/    # controller, service, DTOs (owns itinerary_landmarks)
│   ├── test/               # e2e (supertest)
│   ├── .env.example
│   └── package.json
├── web/                    # React + Vite + TS
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── routes/         # React Router route config + guards
│   │   ├── store/          # Redux Toolkit (or Zustand): auth, landmarks, itineraries
│   │   ├── api/            # typed axios client + service modules
│   │   ├── pages/          # route-level components
│   │   ├── components/     # reusable UI
│   │   └── types/          # shared API types/DTOs
│   └── package.json
└── team-golf-java-green-final-capstone/   # original, kept for reference
```

**Backend stack:** NestJS, Prisma (PostgreSQL), Passport-JWT, `bcrypt`,
`class-validator`/`class-transformer` for DTO validation, `@nestjs/config`
for env, Jest + supertest for tests.

**Frontend stack:** React 18, Vite, TypeScript, React Router 6, axios, and
Redux Toolkit for state (Zustand is a lighter alternative if the global state
stays small). Testing with Vitest + React Testing Library. The original Vue 2
views are reimplemented as React components — the markup/styling ports over,
the state/data-flow is rebuilt idiomatically in React.

## 3. Data model (Prisma)

Mirrors the existing schema (`database/database.sql` + `schema.sql`) with typed
names — the original `summery`/`discription` typos are corrected at the model
layer while keeping DB columns mapped explicitly so existing data still loads.

```prisma
model User {
  id           Int         @id @default(autoincrement()) @map("user_id")
  username     String      @unique
  passwordHash String      @map("password_hash")
  role         String      @default("ROLE_USER")
  itineraries  Itinerary[]
  @@map("users")
}

model Address {
  id         Int        @id @default(autoincrement()) @map("address_id")
  street     String?
  buildingNum Int?      @map("building_num")
  postalCode Int?       @map("postal_code")
  city       String?
  country    String?
  landmarks  Landmark[]
  @@map("address")
}

model Landmark {
  id          Int                  @id @default(autoincrement()) @map("landmark_id")
  name        String
  summary     String
  description String
  img         String
  mapLink     String?              @map("map_link")
  addressId   Int                  @map("address_id")
  address     Address              @relation(fields: [addressId], references: [id])
  images      Image[]
  itineraries ItineraryLandmark[]
  @@map("landmark")
}

model Image {
  imageName  String   @id @map("image_name")
  landmarkId Int      @map("landmark_id")
  landmark   Landmark @relation(fields: [landmarkId], references: [id])
  @@map("images")
}

model Itinerary {
  id        Int                 @id @default(autoincrement()) @map("itinerary_id")
  name      String
  userId    Int                 @map("user_id")
  user      User                @relation(fields: [userId], references: [id])
  landmarks ItineraryLandmark[]
  @@map("itinerary")
}

model ItineraryLandmark {
  itineraryId Int       @map("itinerary_id")
  landmarkId  Int       @map("landmark_id")
  itinerary   Itinerary @relation(fields: [itineraryId], references: [id], onDelete: Cascade)
  landmark    Landmark  @relation(fields: [landmarkId], references: [id])
  @@id([itineraryId, landmarkId])
  @@map("itinerary_landmarks")
}
```

The seed script (`prisma/seed.ts`) ports the address/landmark/image/itinerary
inserts from `database/database.sql` so the demo data is identical.

## 4. API endpoint map (old → new)

REST verbs and resource paths are corrected. **Ownership is derived from the
JWT** (`req.user.id`), never from a path/body parameter.

| Original | New | Notes |
|---|---|---|
| `POST /register` | `POST /auth/register` | role forced to `ROLE_USER` server-side |
| `POST /login` | `POST /auth/login` | returns `{ token, user }` |
| `GET /landmarks` | `GET /landmarks` | public; paginated |
| `GET /landmarks/{id}` | `GET /landmarks/:id` | 404 (not 500) when missing |
| `POST /landmarks/addlandmark` | `POST /landmarks` | admin-only (RolesGuard) |
| `GET /itineraries/{userId}` | `GET /itineraries` | **user from JWT** — fixes IDOR |
| `POST /itineraries/{id}` | `POST /itineraries` | userId from JWT; `RETURNING itinerary_id` fixed |
| `DELETE /itineraries/{id}` | `DELETE /itineraries/:id` | verifies the itinerary belongs to the caller |
| `POST /landmarks/{id}` (add to itinerary) | `POST /itineraries/:id/landmarks` | ownership-checked |
| `POST /itinerarydetails/landmark/{id}` (delete) | `DELETE /itineraries/:id/landmarks/:landmarkId` | proper DELETE verb |
| `GET /itinerarydetails/{id}` | `GET /itineraries/:id/landmarks` | ownership-checked |

## 5. Security fixes baked into the redesign

| Review finding | How the rewrite resolves it |
|---|---|
| Entire API unauthenticated | Global `JwtAuthGuard`; public routes opt out via `@Public()` |
| IDOR on itineraries | All itinerary ops scoped to `req.user.id`; ownership checked before mutate |
| Role escalation at register | `AuthService.register` ignores client role, always `ROLE_USER` |
| Wrong `RETURNING` column | Prisma `create` returns the typed row; no manual SQL |
| Committed secrets / superuser DB | `@nestjs/config` + `.env` (gitignored) + `.env.example`; app DB user, secrets rotated |
| NPE on missing landmark | Service throws `NotFoundException` → clean 404 |
| `findByUsername` full-table scan | `prisma.user.findUnique({ where: { username } })` |
| Weak password handling | `bcrypt` with a sane cost factor; never return `passwordHash` |
| Wide-open CORS | `app.enableCors({ origin: <web origin> })` |

Additional hardening: DTO validation via `ValidationPipe` (whitelist +
forbidNonWhitelisted), Helmet, and rate limiting on `/auth/*`.

## 6. Phased milestones

**Phase 0 — Scaffolding**
- `nest new server`, add Prisma, Config, validation; `npm create vite@latest web -- --template react-ts`.
- `.env.example` for both; wire `DATABASE_URL`, `JWT_SECRET`, `WEB_ORIGIN`.

**Phase 1 — Database & Prisma**
- Author `schema.prisma`; `prisma migrate dev` to generate the schema.
- Port seed data into `prisma/seed.ts`; verify row counts match the old `database.sql`.

**Phase 2 — Auth**
- `AuthModule`: register (forced role), login, bcrypt, JWT issue/verify.
- `JwtStrategy`, global `JwtAuthGuard`, `@Public()` decorator, optional `RolesGuard`.
- Unit tests for register/login; e2e for the auth flow.

**Phase 3 — Landmarks**
- `LandmarksModule`: list (paginated), get-by-id (404), admin create.
- Include images + address relations; e2e tests.

**Phase 4 — Itineraries**
- `ItinerariesModule`: list mine, create, delete (ownership), add/remove landmark, list landmarks.
- Ownership guard/check on every mutating route; e2e covering the IDOR cases.

**Phase 5 — Frontend (React + TS)**
- Redux Toolkit slices: `auth` (token/user persisted to localStorage),
  `landmarks`, `itineraries` — with typed `useAppSelector`/`useAppDispatch` hooks.
- Typed `api/` client (axios instance + interceptor attaching the JWT, plus a
  401 interceptor that logs out and redirects).
- Reimplement the Vue 2 views as React pages/components; React Router 6 with a
  `<ProtectedRoute>` wrapper reading the auth slice.
- Fix the `requiresAuth: false //change back` leftovers (no protected route
  ships unguarded); use the corrected `summary`/`description` field names.

**Phase 6 — Tests, docs, polish**
- Backend: Jest unit + supertest e2e green in CI.
- Frontend: Vitest component tests + a happy-path e2e.
- Top-level `README.md`: setup, env vars, run scripts, architecture diagram.
- Optional: Dockerfile + `docker-compose` (Postgres + api + web) for one-command run.

## 7. Migration notes & decisions

- **Keep the original** under `team-golf-java-green-final-capstone/` for
  reference and portfolio history; the new app lives in `server/` + `web/`.
- **DB compatibility:** Prisma `@map` keeps the existing column names, so the
  same PostgreSQL database/seed works without renaming columns.
- **Field naming:** API/TS uses `summary`/`description`; a thin mapping keeps
  DB columns intact, ending the typo drift without a destructive migration.
- **Frontend choice:** React + TypeScript (confirmed). The original Vue 2
  markup/styling is ported into React components; data flow is rebuilt with
  Redux Toolkit + typed hooks.

## 8. Open questions to confirm before Phase 0

- ~~Frontend framework~~ — **React + TypeScript** (confirmed).
- State management: **Redux Toolkit** (assumed) vs lighter **Zustand**?
- Do you want Docker/`docker-compose` for one-command local run?
- Should admin-only landmark creation stay, or is the catalog read-only/seeded?
- Deployment target (if any) — affects env/config and CORS origin.
