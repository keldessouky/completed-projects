---
title: "MECCHA CHAMELEON (LAN) — Technical Architecture"
status: draft
created: 2026-06-27
updated: 2026-06-27
---

# MECCHA CHAMELEON (LAN) — Technical Architecture

## Context

Lean architecture for the LAN multiplayer remake described in `brief.md`. Driving
constraint: **one person runs it, everyone on the LAN joins from a browser**, so
the whole game ships as a single Node process that serves the client *and* runs
the authoritative realtime server.

## Stack

- **Server:** Node 20+ + TypeScript. `express` serves the built client; `socket.io`
  for realtime rooms/broadcast (robust reconnection + rooms; fine for LAN scale).
  Server is **authoritative** for room/round state and scoring.
- **Client:** TypeScript + **Vite**, rendering to an HTML5 **Canvas 2D**. `socket.io-client`
  for networking. No framework needed.
- **Shared:** a `shared/` folder of TypeScript types — socket message contracts and
  game-state shapes — imported by both sides so the protocol stays type-safe.

## Repository layout

```
meccha-chameleon/
├── package.json          # scripts: dev, build, start (build client, run server)
├── tsconfig.base.json
├── shared/
│   └── protocol.ts       # message types + shared game-state interfaces + constants
├── server/
│   ├── index.ts          # express + socket.io bootstrap; prints LAN URL(s)
│   ├── room.ts           # Room: players, round state machine, timers
│   ├── game.ts           # round logic: roles, scoring, tag resolution
│   └── stage.ts          # stage definition (surfaces/props, colors)
├── client/
│   ├── index.html
│   └── src/
│       ├── main.ts       # socket wiring + scene router (lobby/hide/seek/results)
│       ├── net.ts        # typed socket wrapper
│       ├── render.ts     # Canvas rendering of stage + players
│       ├── paint.ts      # palette + eyedropper + chameleon paint grid
│       └── scenes/*.ts   # lobby, hide, seek, results UIs
└── README.md
```

## Networking model

- **Transport:** WebSocket via socket.io. One server, one "room" for the MVP
  (host's machine); extendable to room codes later.
- **Authority:** server owns the canonical `RoundState` (phase, timer, players,
  scores). Clients send **intents** (move, set pose, paint update, tag); server
  validates against phase and broadcasts state deltas.
- **Tick:** event-driven for discrete actions (pose, tag) + a ~15 Hz state
  broadcast for positions/timer. Paint data is sent on change (debounced), not
  per frame.
- **Player paint representation:** each chameleon is an **N×N grid of color
  cells** (e.g. 8×8). Painting sets cell colors; this is small, cheap to sync,
  and makes blend scoring a simple per-cell color-distance sum — no pixel
  readback needed over the wire.

## Core data (shared/protocol.ts)

- `Phase = 'lobby' | 'hide' | 'seek' | 'results'`
- `Player { id, name, role: 'hider'|'seeker', x, y, pose, paint: Color[]/* grid */, alive, score }`
- `Stage { width, height, surfaces: {rect, color, pattern}[] }`
- `RoundState { phase, endsAt, players, stageId, round, scores }`
- Client→server: `join`, `startMatch`, `move`, `setPose`, `paintCell`, `tag`.
- Server→client: `state` (full/delta), `you` (your id/role), `roundEnd`, `error`.

## Scoring (server-authoritative)

- **Blend score** per Hider: average color distance between each painted cell and
  the stage color the cell overlaps (lower distance → higher blend %). Computed
  server-side from the cell grid + stage definition.
- **Survival points:** accrue each tick a Hider is alive during `seek`, scaled by
  blend %.
- **Risk bonus:** multiplier while the Hider is within the Seeker's view cone /
  sightline — rewards hiding in the open.
- **Seeker:** + for a correct `tag` (a cell-grid actually on a Hider), − for a
  miss; round ends when all Hiders found or timer expires.

## "Pull down and run"

- `npm install` then `npm start` → builds the client (`vite build`) and starts the
  server, which serves the static client and the socket endpoint on `0.0.0.0:3000`
  and **prints every LAN URL** (from `os.networkInterfaces()`), e.g.
  `http://192.168.1.42:3000`. Others open that URL. `npm run dev` runs Vite + server
  with hot reload for development.

## Build milestones

1. **Scaffold** — monorepo, shared protocol, server serves client, socket echo.
2. **Lobby + roles** — join by name, lobby list, host starts, role assignment,
   phase state machine + timers.
3. **Stage + movement + painting** — render stage, move, pose, palette/eyedropper
   paint grid, live blend % feedback.
4. **Seek + scoring** — seeker tagging, sightline risk bonus, scoring, results,
   role rotation.
5. **Verify on LAN + README** — multi-client test, document run/join.

## Verification

- Server boots, prints LAN URLs, serves the client at `/`.
- A headless `socket.io-client` script simulates 2–3 players: join → start →
  paint → tag → results, asserting phase transitions and score changes.
- Load the client in a browser against the running server; confirm a full round
  loop renders and plays.
