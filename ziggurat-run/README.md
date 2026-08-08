# Ziggurat Run

A complete, shippable mobile web game in the shape of a playable ad — auto-runner,
multiplier gates, boss breach — reskinned to Mesopotamian myth. You are an
en-priest with a bow, marching a levy of reed-spear militia up a processional way,
through glazed-brick gates that double or gut your squad, into a ziggurat gate
flanked by two lamassu that wake up halfway through the fight.

Built with **PixiJS 8**, **Howler.js**, **tween.js**, **TypeScript** and **Vite**.
Ships as a single static bundle. Tuned for **iPhone Pro Max Safari**.

```bash
npm install
npm run gen:audio   # synthesize the audio sprite (committed, so usually optional)
npm run dev         # http://localhost:5173
npm run build        # → dist/, a static bundle you can host anywhere
npm run build:single # → dist-single/ziggurat-run.html, the whole game in one file
npm run smoke        # headless Chromium playthrough of every UI flow
npm run smoke:single # …the same 11 checks against the one-file build
```

To just play it: `npm run build && npm run build:single`, then open
`dist-single/ziggurat-run.html` in any browser. That one file carries the code,
both fonts and the entire audio sprite inline, so it needs no server and makes
no network requests at all. Add `--embed` for a body fragment when a host page
supplies its own document shell.

---

## The loop

The hero advances automatically. **Dragging anywhere on screen is the only input** —
direct 1:1 finger tracking with a little smoothing, no virtual joystick. Hero and
squad auto-fire on a shared beat, the squad trailing in a spring-damped V wedge.

Paired gates span the lane: `×2`, `×3`, `+5`, `+10` against traps `−5`, `÷2`, `−50%`.
You steer through one. Between gate sets, enemy clusters close on the line — clay
golems (slow, tanky), scorpion-men (fast, they track you), and Anzu storm-birds
that cross the lane laterally. Anything that reaches the line takes units off you.

Each stage ends at the boss gate. Damage-per-second *is* the surviving squad, so
the whole run is one long argument about how many spearmen you'll have when the
gate comes into view. Breach = win, wipe = fail.

**Gates never rely on colour alone.** Every gate carries a shape mark (chevron for
a blessing, ✕ for a trap) and its value as text, so the read holds for colourblind
players.

## What's in it

- **12 stages, 3 chapters** — alluvial marsh → open steppe → the city of walls.
  Sequential unlock, 1–3 stars per stage from squad size at the boss.
- **Full front-end** — loading screen with real progress, title, chapter map,
  workshop, pause, settings, results, a distinct fail screen, victory sequence.
- **First-run tutorial** — one contextual hand prompt on the first gate pair,
  dismissed on your first steer, never shown again.
- **Meta progression** — 4 permanent upgrades (Levy, Quickdraw, Bronze Tips,
  Ward Seals), 5 levels each, on a real cost curve, bought with coins that come
  home from every run, win or lose.
- **Persistent save** — versioned localStorage schema with field-by-field
  validation and a v1→v2 migration, flushed on `pagehide` so it survives a
  force-quit.
- **Accessibility** — honours `prefers-reduced-motion` (kills shake and slow-mo),
  colourblind-safe gate coding, ≥52 design-px tap targets, contrast-checked HUD text.
- **Dev overlay** — five taps in the top-left corner: FPS, frame time, draw calls,
  live pool counts, jump-to-any-stage, coin grant, 8× turbo.

## Feel

Screen shake scaled by magnitude, hit-flash frames, chunky tweened damage numerals,
particle bursts, cuneiform glyph motes trailing off every arrow. The squad count
never snaps — it eases over 250 ms. Speed and camera pull-back drift up with squad
size. Skimming a trap by a hair triggers 400 ms of 0.4× slow-mo with a
pitch-dropped whoosh. The breach is a freeze-frame, a white flash, then a slow
debris collapse with the lamassu toppling.

Haptics fire through the Vibration API **where available** — feature-detected, and
a silent no-op on iOS Safari, which exposes no Vibration API today.

---

## Architecture

```
src/
  config.ts            EVERY balance constant, with inline comments. No magic
                       numbers live anywhere else in the codebase.
  core/
    game.ts            Context object: renderer, layers, services, lifecycle,
                       WebGL context-loss recovery, the ticker error guard
    loop.ts            Fixed 120 Hz simulation + interpolation + FPS governor
    scaler.ts          Letterboxed scale-to-fit, safe-area insets
    input.ts           Drag steering, 5-tap dev gesture, iOS gesture suppression
    save.ts            Versioned persistence + migration
    audio.ts fx.ts haptics.ts pool.ts
  assets/
    atlas.ts           Canvas2D painters → one 2048² spritesheet
    backdrops.ts       Seeded procedural parallax per chapter
    fonts.ts palette.ts
  game/
    stages.ts          Seeded stage generation (stable layouts per stage)
    economy.ts         Coin math and upgrade effects
  scenes/
    boot title map upgrade endings, run/{runscene,boss,hud,particles}
  ui/
    button digits widgets overlays devoverlay
tools/
  gen-audio.mjs        Offline synthesizer → audio sprite + Howler sprite map
  build-single.mjs     Inlines everything into one self-contained .html
  smoke.mjs            Headless playthrough of every flow
```

### Fixed timestep, decoupled render

Simulation runs at exactly **120 Hz** regardless of refresh rate; rendering
interpolates between the last two sim states with an `alpha`. Gameplay is
therefore identical on a 60 Hz phone and a 120 Hz ProMotion panel. The
accumulator is clamped (`maxStepsPerFrame`) so a long hitch drops its debt
instead of spiralling.

A **frame-rate governor** watches a rolling 2 s window; if average frame time
exceeds 8.3 ms — i.e. we are not really holding 120 — it locks the ticker to a
60 fps cap for the rest of the session, which is steadier than oscillating.

A **thermal guard** cuts the particle budget by 40 % after four minutes of
accumulated play time.

### Zero allocations in the hot loop

Arrows, particles, damage numerals, squad units, corpses, and enemies all live in
fixed-capacity `Pool`s with swap-remove iteration. Nothing is constructed during
play, so there are no GC hitches mid-run.

### Rendering safety

Two failure modes get explicit handling because both are silent killers on a
phone:

1. **WebGL context loss** shows a recoverable message and restores on the next
   touch instead of white-screening.
2. **A throw inside a ticker listener** would permanently stop the game — Pixi
   only requests the next animation frame *after* `Ticker.update()` returns, so
   one exception means no frame 2, ever. Per-frame work is wrapped in
   `Game.guard()`, which reports once and keeps the loop alive.

---

## Device targeting

Design canvas is **440×956 CSS px** (iPhone Pro Max), scale-to-fit with
letterboxing elsewhere; nothing gameplay-critical leaves the box. Renderer
resolution is capped at `min(devicePixelRatio, 2.5)` — DPR 3 on a 6.9" panel
costs more than it returns. Safe-area insets are read from
`env(safe-area-inset-*)` via `viewport-fit=cover`, and no tap target sits in the
Dynamic Island band or the home-indicator strip.

iOS specifics handled: `touch-action: none`, `user-select: none`, no double-tap
zoom, no rubber-band scroll, no 300 ms tap delay, AudioContext unlocked on first
touch (Howler), and `visibilitychange` pausing and muting the game for calls and
app switches.

## Tuning

Stage length runs 60–88 s. You start with 1 unit; a strong run reaches ~80–120 at
the boss. **Stage 1 is built to be won first try** — it has no traps at all,
enemies hold off until three gate pairs have gone by, and its waves skew to cheap
scorpions. That grace period shrinks stage by stage
(`CONFIG.stages.waveLeadGates`).

Every constant is in `CONFIG`, most of them as curves over the stage index, so
rebalancing is a single-file edit.

## Verification

`npm run smoke` builds nothing itself — run `npm run build` first — then boots the
real bundle in headless Chromium and drives the actual UI:

```
✓ boot → title (assets loaded)          ✓ pause → settings → quit to map
✓ title → map                           ✓ workshop purchase persists
✓ stage 1 played to results             ✓ victory screen → map
✓ stage 1 won (stars/unlock/coins)      ✓ dev overlay opens on the corner gesture
✓ doomed run reached the fail screen    ✓ save survives a cold reload
                                        ✓ zero console errors
```

It asserts stage 1 is winnable by a bot that only oscillates left and right, that
the run actually reached the boss gate, and that progress survives a reload.
`--shots DIR` writes a screenshot at each step, and `--single [path]` runs the
identical checks against the one-file build so the inlined bundle is proven
playable, not just smaller.

## Licence

AGPL-3.0-or-later. All art and audio is original and generated by code in this
repo; see [`LICENSES.md`](LICENSES.md) for the full dependency and asset
attribution, including why the sprites and sound are procedural rather than
sourced from Kenney/Freesound, and a note on the licence text itself.
