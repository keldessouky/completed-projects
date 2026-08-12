# Crawler — Muster

An isometric squad game built on the [Ziggurat Run](../ziggurat-run) engine.
One continuous 3,600-unit field seen at a 2:1 dimetric angle, a hero, a cat, and
a crowd of people who walk where you walk. Pick up gold, spend it at a recruit
pad, and march the crowd east until the Iron Keep's gate comes down.

Earth's basements have been repossessed by a game show, and somebody built a
countryside on floor three and then fortified it. You are Carl, barefoot and in
boxer shorts, accompanied by Princess Donut, who is a cat with a title she
awarded herself. The only weapon either of you has is however many people you
can talk into following you.

Built with **PixiJS 8**, **Howler.js**, **tween.js**, **TypeScript** and **Vite**.
Ships as a single static bundle. Tuned for **iPhone Pro Max Safari**.

```bash
npm install
npm run gen:audio   # synthesize the audio sprite (committed, so usually optional)
npm run dev         # http://localhost:5173
npm run build       # → dist/, a static bundle you can host anywhere
npm run build:single # → dist-single/crawler.html, the whole game in one file
npm run smoke        # headless Chromium playthrough of a whole run
npm run smoke:single # …the same 19 checks against the one-file build
```

To just play it: `npm run build && npm run build:single`, then open
`dist-single/crawler.html` in any browser. That one file carries the code, both
fonts and the entire audio sprite inline, so it needs no server and makes no
network requests at all.

---

## The loop

**How many people are behind you is the entire game.** It is your damage, your
health bar and your score at once, and the counter falling is what losing feels
like.

- **Move** by putting a thumb anywhere on the lower half of the screen — the
  stick is born where you touch it and dies when you lift. The stick is a
  *screen* direction; the projection turns it into a world direction, so up is
  always up.
- **Coins** lie all over the field and are hoovered up by walking near them.
  There is no pickup button; bending your walk to collect a coin would make the
  coin the decision, and the decision is where the crowd goes.
- **Recruit pads** turn coins into people, continuously, while you stand on the
  plate. No shop screen, no confirm dialog — the number on the left goes down
  and the number over your head goes up, and you walk off when you have had
  enough. Each recruit costs more than the last, and each pad runs dry.
- **Fighting is automatic.** The squad throws at whatever comes inside its
  range. Their reach is deliberately *shorter* than every enemy's aggro radius,
  so packs always reach the line and always cost you bodies — a crowd that
  killed everything on the approach would be a number that only went up.
- **Princess Donut** is not part of the crew. She has no formation slot, she
  fights on her own account, and nothing can take her off the board — so a wipe
  leaves you with a cat and a direction rather than with nothing.
- **Camps** hold eight or so hostiles and stay cleared. The closer one sits to
  the keep, the worse what lives in it.
- **The Keep**, far north-east, has a gate with 1,800 health and archers on the
  wall who take someone off your line every second you stand there. Whether you
  get through is a straight question of whether your crowd outlasts the door.

There is no inventory, no character sheet, no shop and no fire button. The only
decision the player makes is where to walk, which is the point.

## What's in it

- **A 3,600² seeded field** — three shades of one sunlit meadow from two noise
  fields, a road from the muster post to the keep, sixteen places, all a pure
  function of one seed. Nothing about the field is stored; a save only records
  what you *did* to it.
- **A true 2:1 dimetric projection** confined to one file. The simulation is
  plain cartesian — movement, distances, collision and the spatial hash all
  work exactly as they would top-down — and only *drawing* is isometric.
- **A crowd of sixty** on a spring-damper ring packing, each member holding a
  slot, each slot a deterministic offset. The spring is soft on purpose: the
  crowd lags a body-length behind a sharp turn, which is what makes steering it
  feel like leading people rather than dragging a collider.
- **Streaming everything** — terrain bakes per 384-unit chunk into an LRU of
  screen-space diamond textures, camp populations instantiate as you approach
  and are refunded when you leave, and the coin table only exists as objects
  near the hero. A field this size costs what one crowded screen costs.
- **Real-time combat** — volleys, knockback, a three-state enemy AI with a
  leash that actually lets you walk away, and a spatial hash so 180
  projectiles against 120 enemies is not 21,000 pair tests a frame.
- **Depth sorting that includes the scenery** — structures are their own
  sprites in the same sorted layer as the crowd, so you can stand behind a
  castle wall.
- **The System** — boxed, bureaucratic, faintly hostile notifications; twelve
  achievements that arrive with the pomp of an award and the content of a
  parking notice, each paying gold straight into the purse, because gold is
  people and an achievement that paid out nothing would be a sticker.
- **A read-at-a-glance world layer** — the white ring the crew stands in and
  which grows with it, a chevron trail along the ground to whatever you should
  be walking at, health bars that appear only once something has been hit, and
  the gold you are carrying drawn as an actual stack on Carl's back.
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

That file also carries the style guide, because the voice is the flavour:

> The System is a bored municipal computer that finds you tedious. It uses
> bureaucratic register for atrocities and never once acknowledges that a person
> has died. Carl is exhausted and out of his depth and keeps going anyway; he
> does not quip, he states things. Donut is a cat with a title she awarded
> herself — everything is beneath her and she is nonetheless the loudest thing
> in the room. Nothing is ever framed as heroic. It is a broadcast, and you are
> content.

Floor-specific proper nouns — camps, mobs, the keep — are invented in that
register rather than lifted, so the homage is to the voice and the cast rather
than to a page count.

---

## Architecture

```
src/
  config.ts            EVERY balance constant, with inline comments. No magic
                       numbers live anywhere else in the codebase.
  iso.ts               The projection, and nothing else: world↔screen, the
                       stick's screen→world mapping, and the depth key.
  flavour/             EVERY player-facing string. No logic.
  core/
    game.ts            Context object: renderer, layers, services, the live
                       RunState, the System feed, context-loss recovery
    loop.ts            Fixed 120 Hz simulation + interpolation + FPS governor
    input.ts           The floating joystick, keyboard fallback, dev gesture
    save.ts            Versioned persistence, →v5 migration
    scaler.ts audio.ts fx.ts haptics.ts pool.ts
  assets/
    atlas.ts           Canvas2D painters → one 2048² spritesheet, 3/4 view
    terrain.ts         Per-chunk diamond baking + LRU, structure sprites, and
                       the field overview used by the title card
    fonts.ts palette.ts
  world/
    worldgen.ts        Ground, road, pad/camp/castle layout — pure functions
    worldstate.ts      The live run: position, squad, purse, pads, gate
    squad.ts           The crowd: slots, springs, volleys, losses
    entities.ts        Pooled enemies/projectiles/coins + the spatial hash
    combat.ts          Enemy AI, the squad's volley, projectiles, damage
  game/
    system.ts          The System's feed, and the achievement unlock card
    achievements.ts
  scenes/
    boot title death, world/{world,hud,marks,particles}
  ui/
    joystick button digits widgets overlays devoverlay
tools/
  gen-audio.mjs        Offline synthesizer → audio sprite + Howler sprite map
  build-single.mjs     Inlines everything into one self-contained .html
  smoke.mjs            Headless playthrough of a whole run
```

### The projection lives at the edge

`iso.ts` is the only file that knows the world is drawn at an angle. Everything
in `world/` reasons in plain world units — a distance in config is a distance
you can think about — and the projection is applied when a sprite's position is
set. Keeping it at the edge rather than in the physics is what stops "which
space is this number in" from being a question you have to ask on every line.

The two places it genuinely leaks are both deliberate: the stick's direction is
a *screen* direction and is mapped through `stickToWorld`, and terrain chunks
are baked already in screen space, because a diamond is not something a plain
Sprite can be.

### The field is a function, not a file

Ground shade, road distance, structure layout and the coin table are all pure
functions of `(x, y, seed)`. That means a chunk can be thrown away and rebuilt
identically, the whole map fits in a 320-px overview generated at boot, and a
save holds only the things a player changed: where they stand, how many are
following, which camps are dead, which pads are drained, which coins are gone.
The result is a save measured in kilobytes for a field measured in millions of
square units.

### Where the run lives

`RunState` deliberately does **not** live in a scene. `SceneManager.goto()`
destroys the outgoing scene wholesale, and a run survives the wipe screen and
the title card. `fromSave()` re-clamps every field rather than trusting it, so a
hand-edited save produces a boring run instead of a crash.

### Flat things and tall things sort differently

Structures are sprites rather than part of the terrain bake, but only the
castle joins the depth-sorted actor layer. The rest — the muster plaza, the
recruit plates, a camp's scorch circle — are ground decals anchored at their
centre, and sorting those by that centre paints them straight over anything
standing on their near half. That is not a subtle artifact: it was erasing the
companion every time she walked onto the plaza.

### Fixed timestep, decoupled render

Simulation runs at exactly **120 Hz** regardless of refresh rate; rendering
interpolates between the last two sim states with an `alpha`. Movement is
therefore identical on a 60 Hz phone and a 120 Hz ProMotion panel. A frame-rate
governor locks to 60 if a rolling 2 s window misses the 120 budget, and a
thermal guard cuts the particle budget after four minutes of play.

### Zero allocations in the hot loop

Enemies, projectiles, coins and squad members live in fixed-capacity pools with
swap-remove iteration. Nothing is constructed during play, so there are no GC
hitches mid-fight.

---

## Tuning

Every constant is in `config.ts`, and the three that shape the game most are
ones a player never sees:

- **The squad's reach is shorter than every enemy's aggro radius** (120 against
  380–520). Give the crowd a long reach and packs die on the approach, nobody
  ever touches your line, and the squad counter becomes a number that only goes
  up. The crowd has to be a melee blob that trades bodies.
- **No ranged enemy out-ranges the squad.** A shooter's stand-off is capped
  under the squad's own throwing range, because something you lose people to
  and cannot reach reads as the game cheating rather than as a threat.
- **Contact interval is the real difficulty dial.** A camp of eight biting once
  a second takes eight people a second, which turns any early camp into an
  instant wipe. At 1.4 s the same camp costs a handful while the volley works.

## Verification

`npm run smoke` builds nothing itself — run `npm run build` first — then boots
the real bundle in headless Chromium and *plays* it: it walks with the joystick
by dragging on the canvas, reads the field through the same probe the dev
overlay uses, and taps real buttons. The only seams it takes that a human cannot
are turbo and a warp, because a 3,600-unit field cannot be crossed on foot
inside a test budget.

```
✓ boot → title (assets loaded)          ✓ clearing a camp is recorded
✓ took the field, terrain streamed      ✓ a wipe costs the army and half the purse
✓ joystick moves the hero               ✓ an army can be mustered
✓ the stick is in screen space          ✓ the gate can be reached and broken
✓ coins are collected by walking        ✓ the run survives a cold reload
✓ a recruit pad turns coins into squad  ✓ achievements fire
✓ the squad grows across pads           ✓ pause → settings → quit
✓ camps populate on approach            ✓ dev overlay opens
✓ the squad fights and bleeds           ✓ zero console errors
✓ damage is taken out of the squad
```

One of those is worth calling out. *The stick is in screen space* walks the
joystick straight down the screen and asserts the hero moved south-**east** in
the world — if the projection were ever bypassed those two would be the same
direction, and the whole isometric camera would be a lie the player walks into.

`--shots DIR` writes a screenshot at each step, and `--single [path]` runs the
identical checks against the one-file build so the inlined bundle is proven
playable, not just smaller.

## Licence

AGPL-3.0-or-later. All art and audio is original and generated by code in this
repo; see [`LICENSES.md`](LICENSES.md) for the full dependency and asset
attribution.
