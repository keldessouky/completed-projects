# Crawler — The Open Floor

A top-down open-world RPG built on the [Ziggurat Run](../ziggurat-run) engine.
One continuous 5,120-unit world, free roam with a floating joystick, real-time
combat, quests, loot, gear, and a boss at the far end of the map who is not
going to come to you.

Earth's basements have been repossessed by a game show, and somebody built a
countryside on floor three. You are Carl, barefoot and in boxer shorts, with a
nail gun and a cat.

Built with **PixiJS 8**, **Howler.js**, **tween.js**, **TypeScript** and **Vite**.
Ships as a single static bundle. Tuned for **iPhone Pro Max Safari**.

```bash
npm install
npm run gen:audio   # synthesize the audio sprite (committed, so usually optional)
npm run dev         # http://localhost:5173
npm run build       # → dist/, a static bundle you can host anywhere
npm run build:single # → dist-single/crawler.html, the whole game in one file
npm run smoke        # headless Chromium playthrough of the whole world
npm run smoke:single # …the same 18 checks against the one-file build
```

To just play it: `npm run build && npm run build:single`, then open
`dist-single/crawler.html` in any browser. That one file carries the code, both
fonts and the entire audio sprite inline, so it needs no server and makes no
network requests at all.

---

## The loop

**Go somewhere, and find out what is there.** The world is a single plane with
twenty-one places on it, and the only thing gating any of them is whether you
can survive the walk.

- **Move** by putting a thumb anywhere on the lower half of the screen — the
  stick is born where you touch it and dies when you lift.
- **Fighting is automatic** against the nearest thing in range. On a phone the
  interesting decision is where you stand, not whether you remembered to tap
  attack. Two abilities sit under your thumbs: Firecracker (everything nearby)
  and Second Wind (patch up and run).
- **Camps** hold four or five hostiles and stay cleared for a couple of minutes.
  The further one sits from the first settlement, the worse what lives in it.
- **Ruins and shrines** are quieter: a shrine is a permanent attribute point,
  once, ever.
- **Settlements** have a quest broker, a vendor, and nothing trying to kill you.
- **The Depot**, far east, has the Chief Inspector in it.

Difficulty is geography, not gates. Everything is reachable from minute one and
most of it will kill a level-1 character, which is the whole point of a map.

## What's in it

- **A 5,120² seeded world** — five biomes crossed from two noise fields, roads
  between the settlements, twenty-one places, all a pure function of one seed.
  Nothing about the world is stored; a save only records what you *did* to it.
- **Streaming everything** — terrain bakes per 512-unit chunk into an LRU of
  textures, and enemy populations instantiate as you approach and are refunded
  when you leave. A world this size costs what one crowded screen costs.
- **Real-time combat** — auto-attack, knockback, crits, a three-state enemy AI
  with a leash that actually lets you disengage, and a spatial hash so 220
  projectiles against 120 enemies is not 26,000 pair tests a frame.
- **Character progression** — levels, seven attributes, and three gear slots
  where every item is one number (its stat budget) that damage, health and
  attribute bonuses all read off.
- **Quests** — a five-step line from pest control to the Depot, tracked in a
  journal, handed out and turned in through real dialogue.
- **A vendor** — buy and sell, with CHA visibly moving the asking price.
- **A minimap with fog of war**, run-length encoded into the save.
- **Death that costs something** — a fifth of your gold and the walk back.
  Everything you found, cleared and looted is still yours.
- **The System** — boxed, bureaucratic, faintly hostile notifications, and eight
  sarcastic achievements.
- **Accessibility** — honours `prefers-reduced-motion`, ≥52 design-px tap
  targets, contrast-checked HUD text, keyboard movement on desktop.
- **Dev overlay** — five taps in the top-left corner: FPS, frame time, live
  entity counts, and a warp pad to any place on the map.

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
                       WorldState, the System feed, context-loss recovery
    loop.ts            Fixed 120 Hz simulation + interpolation + FPS governor
    input.ts           The floating joystick, keyboard fallback, dev gesture
    save.ts            Versioned persistence, v3→v4 migration
    scaler.ts audio.ts fx.ts haptics.ts pool.ts
  assets/
    atlas.ts           Canvas2D painters → one 2048² spritesheet, three facings
    terrain.ts         Per-chunk terrain baking + LRU, and the world thumbnail
    fonts.ts palette.ts
  world/
    worldgen.ts        Biomes, roads, POI layout — all pure functions of a seed
    worldstate.ts      The live world: position, health, quests, fog, inventory
    entities.ts        Pooled enemies/projectiles/drops + the spatial hash
    combat.ts          Enemy AI, projectiles, damage, knockback
    quests.ts          The quest line as data
  game/
    stats.ts           Levels, attributes, gear — every derived combat number
    loot.ts system.ts achievements.ts
  scenes/
    boot title charsheet inventory journal shop death,
    world/{world,hud,particles}
  ui/
    joystick minimap dialogue button digits widgets overlays devoverlay
tools/
  gen-audio.mjs        Offline synthesizer → audio sprite + Howler sprite map
  build-single.mjs     Inlines everything into one self-contained .html
  smoke.mjs            Headless playthrough of the whole world
  dev/dumpworld.ts     Print the generated world for balance work
```

### The world is a function, not a file

Terrain colour, biome, road distance and POI layout are all pure functions of
`(x, y, seed)`. That means a chunk can be thrown away and rebuilt identically,
the whole map fits in a 128×128 thumbnail generated at boot, and a save holds
only the things a player changed: where they stand, what they discovered, what
they cleared, what they are carrying. The result is a save measured in
kilobytes for a world measured in millions of square units.

### Where the world lives

`WorldState` deliberately does **not** live in a scene. `SceneManager.goto()`
destroys the outgoing scene wholesale, and roaming is punctuated by inventory,
shop, dialogue and character screens — so position, health, quest progress and
the fog of war hang off the game context instead. `fromSave()` re-clamps every
field rather than trusting it, so a hand-edited save produces a boring world
instead of a crash.

### Fixed timestep, decoupled render

Simulation runs at exactly **120 Hz** regardless of refresh rate; rendering
interpolates between the last two sim states with an `alpha`. Movement is
therefore identical on a 60 Hz phone and a 120 Hz ProMotion panel. A frame-rate
governor locks to 60 if a rolling 2 s window misses the 120 budget, and a
thermal guard cuts the particle budget after four minutes of play.

### Zero allocations in the hot loop

Enemies, projectiles and ground loot live in fixed-capacity pools with
swap-remove iteration. Nothing is constructed during play, so there are no GC
hitches mid-fight.

---

## Tuning

Every constant is in `config.ts`, and the two that shape the game most are the
ones a player never sees:

- **No ranged enemy out-ranges you.** The AI stops at `range × 0.8`, and every
  shooter's stop distance clears the player's 232-unit attack range. A shooter
  that outranges you cannot be approached without eating free hits, which reads
  as the game cheating rather than as a threat.
- **The boss does not scale with your level.** Ordinary mobs do (capped at
  ×2.2), so a camp is still worth walking to at level 12. The Depot is a fixed
  wall you are meant to grow into — a wall that grows with you means levelling
  buys nothing.

`tools/dev/dumpworld.ts` prints the generated world — every POI, its distance
from the first settlement, its biome and its population — so balance work does
not mean wandering around looking for it.

## Verification

`npm run smoke` builds nothing itself — run `npm run build` first — then boots
the real bundle in headless Chromium and *plays* it: it walks with the joystick
by dragging on the canvas, reads the world through the same probe the dev
overlay uses, and taps real buttons. The only seams it takes that a human cannot
are turbo and a warp, because a 5,120-unit world cannot be crossed on foot
inside a test budget.

```
✓ boot → title (assets loaded)          ✓ attribute point spent
✓ entered the world, terrain streamed   ✓ journal lists quests and places
✓ joystick moves the player             ✓ vendor opens and closes
✓ quest accepted through dialogue       ✓ death costs gold, respawn is whole
✓ camp populated on approach            ✓ the boss can be found and killed
✓ combat works                          ✓ world survives a cold reload
✓ loot picked up                        ✓ pause → settings → quit
✓ gear equipped from the bag            ✓ dev overlay opens
✓ shrine grants an attribute point      ✓ zero console errors
```

`--shots DIR` writes a screenshot at each step, and `--single [path]` runs the
identical checks against the one-file build so the inlined bundle is proven
playable, not just smaller.

## Licence

AGPL-3.0-or-later. All art and audio is original and generated by code in this
repo; see [`LICENSES.md`](LICENSES.md) for the full dependency and asset
attribution.
