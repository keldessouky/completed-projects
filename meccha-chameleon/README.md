# 🦎 MECCHA CHAMELEON — LAN edition

A local-network, browser-based hide-and-seek inspired by the Steam game
*MECCHA CHAMELEON*. **Hiders** paint their plain white chameleon to camouflage
into the stage; a **Seeker** hunts them before time runs out. Everyone plays
from their own browser on the same Wi-Fi — no accounts, no internet.

One person runs it, shares the printed URL, and everyone on the network joins.

## Run it (one command)

```bash
npm install
npm start
```

`npm start` builds the client and starts the server, which prints every URL on
your network, e.g.:

```
  🦎  MECCHA CHAMELEON (LAN) is running!
  Share one of these URLs with everyone on your network:
     http://localhost:3000
     http://192.168.1.42:3000
```

Everyone on the same network opens the `192.168.x.x` URL in a browser, types a
name, and joins. The **host** (first to join) presses **Start match**. Need at
least 2 players.

## How to play

A match is a series of short rounds; one player is the **Seeker** each round
(the role rotates).

1. **Hide (45s)** — Hiders move with **WASD / arrows**, pick a **pose** (changes
   your silhouette), and **paint** their 8×8 chameleon:
   - Use the **💧 eyedropper** to sample the surface color, then paint your body
     to match.
   - Surfaces have a light→shadow gradient and subtle texture, so **don't use a
     single flat color** — add lighter and darker shades. Your live
     **Camouflage %** tells you how well you blend.
2. **Seek (60s)** — the Seeker scans the stage and **clicks** anything that looks
   like a hider. A correct tag eliminates them; a miss costs points.
3. **Results** — points are tallied, roles rotate, next round.

**Scoring** rewards both survival and nerve:
- Hiders earn points each moment they stay hidden, scaled by camouflage quality.
- **Risk bonus:** hiding out in the open (e.g. the red rug) pays *more* — if your
  paint job holds up.
- Seekers earn points for correct tags (tougher finds pay more) and lose them for
  misses.

## Develop

```bash
npm run dev        # Vite client (:5173) + auto-reloading server (:3000)
npm run typecheck  # tsc --noEmit
npm run test:sim   # headless end-to-end: spawns the server, plays a full round
npm start          # build client + serve (production / LAN)
```

## How it works

Single Node process: **Express** serves the built client and **socket.io** runs
the authoritative game. The server owns round state and scoring; clients send
intents (move, pose, paint, tag).

```
meccha-chameleon/
├── shared/    # protocol (messages, constants), stages, and the blend-scoring maths
├── server/    # express + socket.io bootstrap, Room state machine, scoring
├── client/    # Vite + Canvas 2D: rendering, paint editor, scene panels
└── scripts/   # sim.ts — headless multiplayer test
```

The **camouflage score** is real: for each painted cell of a chameleon, the
server compares its color to the stage color directly behind it (with the
light/shadow gradient) and averages the distance. The same maths runs on the
client for the live Camouflage % readout. Stage definitions live in `shared/` so
scoring and rendering always agree.

## Notes & scope

- **LAN-only by design** — no internet matchmaking, no accounts, no anti-cheat
  (trusted local party). The server binds `0.0.0.0` so any device on the network
  can reach it; make sure your OS firewall allows the port (default `3000`, set
  `PORT` to change).
- Desktop/laptop browsers (mouse painting) are the primary target.
- 2–10 players is the sweet spot.
