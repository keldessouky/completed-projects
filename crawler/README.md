# Crawler — Floor One

A dungeon crawler built on the [Ziggurat Run](../ziggurat-run) engine, where **a
floor is a map**: a node graph you route through under a countdown, with rooms
that pay out once and a boss that will not let you leave until it is down.

Earth's basements have been repossessed by a game show. You are Carl, barefoot
and in boxer shorts, and the stairs seal in eight minutes.

Built with **PixiJS 8**, **Howler.js**, **tween.js**, **TypeScript** and **Vite**.
Ships as a single static bundle. Tuned for **iPhone Pro Max Safari**.

```bash
npm install
npm run gen:audio   # synthesize the audio sprite (committed, so usually optional)
npm run dev         # http://localhost:5173
npm run build       # → dist/, a static bundle you can host anywhere
npm run build:single # → dist-single/crawler.html, the whole game in one file
npm run smoke        # headless Chromium playthrough of a whole floor
npm run smoke:single # …the same 13 checks against the one-file build
```

To just play it: `npm run build && npm run build:single`, then open
`dist-single/crawler.html` in any browser. That one file carries the code, both
fonts and the entire audio sprite inline, so it needs no server and makes no
network requests at all.

---

## The loop

**The floor is the game.** You arrive at the entry node with a party of one and
a clock. Every room you enter is a bet: it pays party members, gold and XP, and
it costs time you might have wanted for the boss.

- **Tunnels** are the auto-runner. Drag anywhere to steer; Carl and the party
  auto-fire on a shared beat, trailing in a spring-damped wedge. Paired doors
  span the tunnel — `×2` `×3` `+5` `+10` against `−5` `÷2` `−50%` — and you walk
  through exactly one.
- **Nests** are a closed room. No scroll; waves arrive on a timer and you clear
  every one of them to leave.
- **Loot boxes** are bronze, silver or gold, and LUCK upgrades the box itself
  rather than adding a separate rare-drop roll.
- **Safe rooms** heal you back toward your peak for free and sell party members
  and attribute points for gold you could have banked instead.
- **The boss** blocks the stairs. It closes on your line the whole fight, so you
  get about twenty seconds of fire no matter how big your party is — which means
  the real question was answered several rooms ago.

Rooms are one-shot, but you can always walk back through a cleared one. That
costs travel time and nothing else, and it means a dead end can never strand you.

**Damage-per-second is simply the party**, so the whole floor is one long
argument about how many people you will have standing when you knock.

## What's in it

- **Floor 1 of 18** — a seeded 13-node graph, identical on every attempt, with
  every curve in `config.ts` written as a function of floor index so floors 2+
  are a data change rather than a code change.
- **A real clock** — 8 minutes. It only runs while you are in a room; moving and
  shopping bill fixed costs, so nobody is punished for reading the screen. Run it
  out and the stairs seal with you on the wrong side.
- **Character progression** — level, XP, and seven attributes with the derived
  value shown live beside each one, so a point is spent against a number you can
  watch move.
- **Two abilities** — Firecracker (screen-wide damage) and Second Wind (pulls
  stragglers back into the line), on cooldowns that INT shortens.
- **The System** — a queue of boxed, bureaucratic, faintly hostile notifications.
  One at a time, and never over the floor clock.
- **Achievements** — seven of them, sarcastically named, paid in gold.
- **Mid-floor resume** — a crawl is eight minutes and a phone call is one, so the
  live floor is serialised on `pagehide` and offered back on the title screen.
- **Accessibility** — honours `prefers-reduced-motion`, colourblind-safe door
  coding (shape mark *and* value text, never colour alone), ≥52 design-px tap
  targets, contrast-checked HUD text.
- **Dev overlay** — five taps in the top-left corner: FPS, frame time, draw
  calls, live pool counts, jump to a floor, grant gold and points, 8× turbo.

## Flavour is a swappable layer

Every player-facing name and line lives in [`src/flavour/`](src/flavour/index.ts)
and nothing else in the codebase contains a proper noun. The current cast is a
homage to *Dungeon Crawler Carl*; replacing that one file re-skins the game to an
original one, which is what a distributable build would want. Gameplay numbers
live in `config.ts`, strings live in `flavour/`, and neither imports the other.

---

## Architecture

```
src/
  config.ts            EVERY balance constant, with inline comments. No magic
                       numbers live anywhere else in the codebase.
  flavour/             EVERY player-facing string. No logic.
  core/
    game.ts            Context object: renderer, layers, services, the live
                       RunState, the System feed, WebGL context-loss recovery
    loop.ts            Fixed 120 Hz simulation + interpolation + FPS governor
    scaler.ts          Letterboxed scale-to-fit, safe-area insets
    input.ts           Drag steering, 5-tap dev gesture, iOS gesture suppression
    save.ts            Versioned persistence, v2→v3 migration, mid-floor resume
    audio.ts fx.ts haptics.ts pool.ts
  assets/
    atlas.ts           Canvas2D painters → one 2048² spritesheet
    backdrops.ts       Seeded procedural parallax per floor
    fonts.ts palette.ts
  game/
    floors.ts          Seeded floor generation: the node graph and its contents
    runstate.ts        The live floor — clock, party, position, persistence
    stats.ts           Levels, attributes, and every derived combat number
    loot.ts system.ts achievements.ts
  scenes/
    boot title floormap loot safe charsheet endings,
    encounter/{encounter,boss,hud,particles}
  ui/
    button digits widgets overlays devoverlay
tools/
  gen-audio.mjs        Offline synthesizer → audio sprite + Howler sprite map
  build-single.mjs     Inlines everything into one self-contained .html
  smoke.mjs            Headless playthrough of a whole floor
  dev/dumpfloor.ts     Print a generated floor for balance work
```

### Where the floor lives

`RunState` deliberately does **not** live in a scene. `SceneManager.goto()`
destroys the outgoing scene wholesale, and a floor spans many of them — map,
tunnel, map, safe room, map, boss — so the clock, the party and your position
hang off the game context instead. That object is also the unit of persistence:
`toSave()`/`fromSave()` are what make resume possible, and `fromSave()` re-clamps
every field rather than trusting it, so a hand-edited save produces a boring
floor instead of a crash.

### One scene, three room shapes

Tunnels, nests and boss rooms share `EncounterScene` because they share almost
everything: pools, formation springs, volleys, collisions, contact, endings. What
differs is only the spawn driver (distance-keyed vs. time-keyed vs. none) and the
exit test, so those live behind `this.def.kind` rather than in three near-identical
scenes.

### Fixed timestep, decoupled render

Simulation runs at exactly **120 Hz** regardless of refresh rate; rendering
interpolates between the last two sim states with an `alpha`. Gameplay is
therefore identical on a 60 Hz phone and a 120 Hz ProMotion panel. The
accumulator is clamped (`maxStepsPerFrame`) so a long hitch drops its debt
instead of spiralling. A **frame-rate governor** watches a rolling 2 s window; if
average frame time exceeds 8.3 ms it locks the ticker to 60 fps for the rest of
the session, which is steadier than oscillating. A **thermal guard** cuts the
particle budget by 40 % after four minutes of accumulated play.

### Zero allocations in the hot loop

Nails, particles, damage numerals, party members, corpses and mobs all live in
fixed-capacity `Pool`s with swap-remove iteration. Nothing is constructed during
play, so there are no GC hitches mid-room.

### Rendering safety

Two failure modes get explicit handling because both are silent killers on a
phone: **WebGL context loss** shows a recoverable message and restores on the
next touch instead of white-screening, and **a throw inside a ticker listener**
is caught by `Game.guard()` — Pixi only requests the next animation frame after
`Ticker.update()` returns, so one unguarded exception means no frame 2, ever.

---

## Device targeting

Design canvas is **440×956 CSS px** (iPhone Pro Max), scale-to-fit with
letterboxing elsewhere; nothing gameplay-critical leaves the box. Renderer
resolution is capped at `min(devicePixelRatio, 2.5)`. Safe-area insets are read
from `env(safe-area-inset-*)` via `viewport-fit=cover`, and no tap target sits in
the Dynamic Island band or the home-indicator strip.

iOS specifics handled: `touch-action: none`, `user-select: none`, no double-tap
zoom, no rubber-band scroll, no 300 ms tap delay, AudioContext unlocked on first
touch (Howler), and `visibilitychange` pausing and muting the game for calls and
app switches.

## Tuning

The floor clock is 8 minutes; a full sweep of all eleven rooms costs roughly 395 s
of it, so completionism is possible and never comfortable. You start with a party
of one; a tunnel takes you to ~50, and the boss needs about 30 to beat the crush
timer at base damage. `tools/dev/dumpfloor.ts` prints any generated floor —
graph, clock estimates, and every door and wave — so balance work does not mean
replaying the game.

## Verification

`npm run smoke` builds nothing itself — run `npm run build` first — then boots the
real bundle in headless Chromium and drives the actual UI. The bot taps real node
buttons at coordinates the floor map publishes; it does not call into game logic
to move itself.

```
✓ boot → title (assets loaded)          ✓ mid-floor resume restores position + clock
✓ title → floor 1 map                   ✓ running out of clock seals the floor
✓ floor 1 cleared by an oscillating bot ✓ pause → settings → quit to floor map
✓ route hits every room type            ✓ dev overlay opens on the corner gesture
✓ levelling works                       ✓ save survives a cold reload
✓ achievements unlock                   ✓ zero console errors
✓ attribute points spend
```

It asserts floor 1 is clearable by a bot that only oscillates left and right,
that the route exercised a tunnel, a nest, a loot box and a safe room, that the
boss was actually fought, and that progress survives a reload. `--shots DIR`
writes a screenshot at each step, and `--single [path]` runs the identical checks
against the one-file build so the inlined bundle is proven playable, not just
smaller.

## Licence

AGPL-3.0-or-later. All art and audio is original and generated by code in this
repo; see [`LICENSES.md`](LICENSES.md) for the full dependency and asset
attribution.
