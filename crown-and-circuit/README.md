# Crown & Circuit

The playable-ad loop, built for real — and then carried five technology ages past
where the ad stops.

You march a king around a field. His soldiers fight for him. Every kill spills
coins you have to physically sweep up and *carry* to a build pad, where they
drain out of your hands one at a time to raise a tower. Towers grow walls between
them, the walls close into a fort, and waves of horrors come in from the map
edges to take it apart. Survive four waves and the age advances: swords become
muskets become rifles become machine guns become lasers, and the world, your
army, the fort and the music all change with it.

Built with **PixiJS 8**, **Howler.js**, **tween.js**, **TypeScript** and **Vite**.

```bash
npm install
npm run dev           # http://localhost:5173
npm run build         # → dist/
npm run build:single  # → dist-single/crown-and-circuit.html, the whole game in one file
npm run smoke         # headless Chromium playthrough
npm run smoke:single  # the same checks against the one-file build
```

To just play it: `npm run build && npm run build:single`, then open
`dist-single/crown-and-circuit.html` in any browser. No server, no install, no
network.

---

## Controls

Drag anywhere to march — the stick appears where you press, so it never fights
the UI. **WASD / arrows** also work on desktop. That is the only movement input;
your soldiers aim and fire themselves.

Walk onto a glowing ring to open the build menu, pick what to raise, then *stand
there* while your coins pour into it. Walking away pauses the build; the coins
stay banked in the pad until you come back.

---

## The loop

**Fight → haul → build → hold.** Kills drop coins that scatter on the ground. A
magnet radius sweeps them up as you run over them, and your carry meter fills —
coins in hand are worth nothing until you spend them, which is the whole tension.
Build pads sit in concentric rings around the keep; filling 60% of a ring unlocks
the next one outward.

Three things to build:

| | |
| --- | --- |
| **Tower** | Auto-fires with the era's weapon. Missile towers (Steel era) splash. |
| **Barracks** | Permanently adds soldiers to your marching squad. |
| **Forge** | Raises damage for everything you own. |

Any pad can be upgraded three times. Adjacent built pads on the same ring grow a
**wall** between them automatically, and enemies have to chew through it — except
flyers, which ignore walls entirely.

Between waves you pick one of three upgrade cards. Lose the keep and the run ends;
shards earned buy permanent upgrades at the War Table for the next one.

## The five ages

Every four waves the age turns over. This re-stats and re-skins the whole game
from one table in `CONFIG.eras`:

| Age | Weapon | Tower | World |
| --- | --- | --- | --- |
| **Iron** | Sword & spear | Arrow turret | Mossy river valley |
| **Powder** | Musket | Cannon | Churned mud and smoke |
| **Industry** | Bolt rifle | Gatling | Soot, rivets, iron plate |
| **Steel** | Machine gun | Missile rack | Concrete and olive drab |
| **Neon** | Laser | Plasma emitter | Black glass under a neon grid |

The display typeface changes with it — Cinzel for the medieval half, Orbitron
once you reach Steel. The music is one chord progression played five ways, from
plucked strings to a synth arpeggio, so the score evolves rather than cutting to
an unrelated track.

---

## Art

All sprites are original pixel art, generated at boot. `src/assets/pixel.ts` is a
small pixel-art toolkit — integer grid, three-tone palette ramps, an auto-dilated
1px outline, top-left lighting, nearest-neighbour output. `src/assets/sprites.ts`
draws with it.

Units come from one parameterised generator rather than being drawn individually,
so all five eras of king plus fifteen soldier variants share a silhouette and a
light source while changing armour, cape and weapon.

**Want to use an art pack instead?** Drop images and a `manifest.json` into
`public/art/` and they override the built-in frames at boot — no rebuild. See
[`public/art/README.md`](public/art/README.md) for the frame names. That folder is
gitignored deliberately: several popular packs allow use but forbid
redistribution, so your copies stay on your machine.

---

## Architecture

```
src/
  config.ts          EVERY balance constant, including the 5-era table
  core/
    game.ts          Context: renderer, layers, services, lifecycle, error guard
    loop.ts          Fixed 60 Hz sim + interpolation + FPS governor
    camera.ts        Free-roam camera, adaptive viewport, UI scaling
    grid.ts          Uniform spatial hash (broadphase)
    input.ts         Floating stick + WASD, 5-tap dev gesture
    save.ts audio.ts fx.ts haptics.ts pool.ts
  assets/
    pixel.ts         Pixel-art toolkit
    sprites.ts       Every sprite, authored on the grid
    atlas.ts         Packs them into one 2048² sheet
    terrain.ts       Per-era ground tiles
    artpack.ts       Optional external overrides
  game/
    world.ts         The simulation: king, squad, horde, shots, coins
    fort.ts          Pads, structures, ring walls
    waves.ts         Wave director and era advance
    cards.ts particles.ts
  scenes/            boot, title, run, menus (results + war table)
  ui/                button, digits, widgets, overlays, devoverlay
tools/
  gen-audio.mjs      Offline synthesizer → audio sprite
  build-single.mjs   Inlines everything into one .html
  smoke.mjs          Headless playthrough
```

### Hundreds of entities, bounded cost

Up to 240 enemies, 48 soldiers, 512 projectiles and 400 coins can be live at once.
Naive pair testing there is ~10⁵ checks per step and would eat the frame, so every
"what is near me" query goes through a uniform spatial hash (`core/grid.ts`) that
scans nine small cells instead. Everything hot is pooled with swap-remove
iteration, so play is allocation-free and there are no GC hitches.

Wall collision is done in **polar coordinates**: because the rings are circles, an
enemy crossing a ring radius inward is blocked if its angle falls inside a built
arc. That is O(rings) per enemy rather than a segment test per wall.

The simulation runs at a fixed **60 Hz** decoupled from rendering, which
interpolates between the last two states — gameplay is identical at 60, 144 or
240 fps. A governor drops to a 60 fps render cap if a 2-second window misses its
budget, and a thermal guard trims particles after four minutes.

### Failure modes handled on purpose

- **WebGL context loss** shows a recoverable message instead of white-screening.
- **A throw inside a ticker listener** would stop the game permanently — Pixi only
  requests the next frame *after* `Ticker.update()` returns. Per-frame work runs
  inside `Game.guard()`, which reports once and keeps the loop alive.
- **Modal overlays** are parented to a layer that scene transitions clear, so a
  pause menu can never outlive its scene and silently eat input.

---

## Verification

`npm run smoke` builds nothing itself — run `npm run build` first — then boots the
real bundle in headless Chromium and drives the actual UI:

```
✓ boot → title (atlas, terrain and audio loaded)
✓ title → run
✓ coin ferry built a tower
✓ survived to wave N and took an upgrade card
✓ pause overlay opens and halts the simulation
✓ war table purchase persists
✓ save survives a cold reload
✓ zero console errors
```

It steers the king with real pointer drags, walks him onto a pad, and asserts the
deposit actually completed a structure — the ferry loop is verified end to end,
not mocked. `--shots DIR` writes a screenshot per step; `--single` runs the same
checks against the one-file build.

## Licence

AGPL-3.0-or-later. All art and audio is original and generated by code in this
repo — see [`LICENSES.md`](LICENSES.md).
