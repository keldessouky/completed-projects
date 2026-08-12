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
npm run art:export   # → art-template/, the cast as PNG sheets you can repaint
npm run art:check    # verify custom sheets in public/art/ before you reload
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
- **Animated, cel-shaded art at 3× supersampling** — one articulated rig
  drives every person in the game through a four-frame walk cycle and an
  attack pose, in five painted facings mirrored to eight. Every shape is
  filled three times from a single path — light, base, shade — against one
  fixed light direction, so a sprite, a tree and a castle wall are all lit by
  the same sun.
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

# Replacing the character art

The cast is drawn in code, but it does not have to be. Drop PNG sprite sheets
into `public/art/` and the game loads them over its own art at boot — same
names, same animation, same facing, same depth sorting, same hit flash. Nothing
else in the codebase changes.

This section is meant to be followed literally. At the end of it you will have
a different-looking character walking around.

## The five-minute version

```bash
npm install
npm run build          # art:export reads the built game
npm run art:export     # writes art-template/ — every character, correctly sized
cp art-template/hero.png art-template/manifest.json public/art/
```

Open `public/art/manifest.json` and delete everything from `actors` except the
line for `hero`, so it reads:

```json
{
  "scale": 3,
  "actors": {
    "hero": { "file": "hero.png", "cell": [60, 76] }
  }
}
```

Now open `public/art/hero.png` in any image editor and paint over it. **Do not
resize the file.** Then:

```bash
npm run art:check      # confirms the sheet is still the right size
npm run dev            # http://localhost:5173
```

Carl is now whatever you painted. The browser console prints
`[art] hero: replaced from hero.png` at boot.

## Where everything lives

| Thing | Path |
| --- | --- |
| Your sheets and manifest | `public/art/` |
| Generated starting points | `art-template/` (gitignored, regenerate any time) |
| The loader | `src/assets/overrides.ts` |
| The painted art it replaces | `src/assets/atlas.ts`, `src/assets/figure.ts` |

You never edit `src/` to replace art. `public/art/manifest.json` is the only
file you write by hand.

## What a sheet is

One PNG per character. A grid of cells, **5 columns × 5 rows**, no padding, no
margin, transparent background.

```
            col 0      col 1      col 2      col 3      col 4
          ┌──────────┬──────────┬──────────┬──────────┬──────────┐
 row 0  s │ walk 0   │ walk 1   │ walk 2   │ walk 3   │ attack   │   facing the camera
          ├──────────┼──────────┼──────────┼──────────┼──────────┤
 row 1 se │          │          │          │          │          │   down-right
          ├──────────┼──────────┼──────────┼──────────┼──────────┤
 row 2  e │          │          │          │          │          │   right
          ├──────────┼──────────┼──────────┼──────────┼──────────┤
 row 3 ne │          │          │          │          │          │   up-right
          ├──────────┼──────────┼──────────┼──────────┼──────────┤
 row 4  n │          │          │          │          │          │   away from the camera
          └──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Only the right-hand facings are drawn.** The game mirrors row 1 to get
down-left, row 2 to get left and row 3 to get up-left, so you paint five
directions and get eight. Do not add left-facing rows; they will be ignored.

The walk is a standard four-frame cycle: **0** left foot planted, **1** passing
(body at its highest), **2** right foot planted, **3** passing again. Column 4
is a single attack pose, held for about a fifth of a second whenever that
character throws, swings or bites.

### Format

- **PNG**, 32-bit RGBA, transparent background. (`.webp` also works.)
- No premultiplied alpha, no colour profile, no interlacing — anything a plain
  "export as PNG" produces is fine.
- Nearest-neighbour or smooth art both work; the game samples it linearly.

### Size

Every cell is the same size. The size is up to you, but the sheet must be
exactly `cell × scale × 5` in both directions.

```
sheet width  = cell width  × scale × 5
sheet height = cell height × scale × 5
```

`scale` is how many image pixels you are drawing per **design pixel** — the
game's own unit, of which the screen is 440 × 956. The shipped art uses
`scale: 3`, so a character that occupies 60 × 76 design pixels on screen is
painted at 180 × 228.

These are the current cell sizes, which is what `art:export` gives you:

| Sheet | Cell (design px) | Sheet at scale 3 | Who |
| --- | --- | --- | --- |
| `hero.png` | 60 × 76 | 900 × 1140 | Carl |
| `donut.png` | 44 × 50 | 660 × 750 | Princess Donut |
| `levy0.png` | 40 × 52 | 600 × 780 | your crew, under 12 |
| `levy1.png` | 40 × 52 | 600 × 780 | your crew, 12–29 |
| `levy2.png` | 40 × 52 | 600 × 780 | your crew, 30+ |
| `grunt.png` | 46 × 54 | 690 × 810 | Redcloak |
| `archer.png` | 48 × 54 | 720 × 810 | Slinger |
| `heavy.png` | 64 × 68 | 960 × 1020 | Bruiser |
| `captain.png` | 78 × 92 | 1170 × 1380 | Floor Captain |

You can change a cell size — a taller hero just needs its `cell` updated and
the PNG resized to match. `npm run art:check` does that arithmetic for you and
tells you the exact pixel size it expects.

Want crisper art without changing how big the character is on screen? Raise
`scale` to 4 and make the sheet proportionally larger. Want a genuinely bigger
character? Raise `cell` instead.

### Where the character has to sit inside its cell

Sprites are anchored **bottom-centre**. The game places the anchor on the exact
point of ground the character is standing on.

- **Feet at the very bottom edge** of the cell. Not floating, not cropped.
- **Horizontally centred**, and centred consistently across all 25 cells — an
  off-centre cell makes that frame of the walk jerk sideways.
- Everything above the feet is free space: hats, plumes and raised weapons just
  need cell height to live in.
- Draw a **contact shadow** at the bottom of the cell if you want one. The game
  does not add one; the shipped art paints its own.

Empty space costs nothing but atlas memory, so leave a pixel or two of margin
rather than clipping a helmet.

## The manifest

`public/art/manifest.json` is the only thing that decides what gets replaced.
No manifest means no replacement — the folder can be full of PNGs and the game
will happily ignore them (`art:check` warns about that).

```json
{
  "scale": 3,
  "actors": {
    "hero":  { "file": "hero.png",  "cell": [60, 76] },
    "grunt": { "file": "grunt.png", "cell": [46, 54] },
    "boss":  { "file": "boss.png",  "cell": [96, 120], "scale": 4 }
  }
}
```

- `scale` at the top is the default for every sheet.
- `scale` inside an entry overrides it for that one sheet, so you can mix a 4×
  hero with 3× everything else.
- `cell` is `[width, height]` in **design** pixels — not image pixels.
- Anything you leave out keeps the art the game paints for itself. Replacing
  only the hero is a perfectly normal end state.

Valid actor keys: `hero`, `donut`, `levy0`, `levy1`, `levy2`, `grunt`,
`archer`, `heavy`, `captain`. A key the game does not know is loaded and then
never asked for, which is silent — check your spelling against that list.

## Checking your work

```bash
npm run art:check
```

```
  ok  hero: hero.png is 900×1140
FAIL  grunt: grunt.png is 690×812, expected 690×810 (cell 46×54 × scale 3 × 5×5 cells)
```

Wrong sheet size is the failure worth having a command for, because it is the
one that looks *nearly* right: a sheet two pixels too tall slices every row
slightly off and the whole cast develops a twitch. Everything else announces
itself — a missing file, a bad JSON comma or an unreadable PNG all print
`[art] … FAILED` in the browser console and leave the painted art in place.

The game never fails to start because of custom art. A broken sheet is always a
logged line and the original character, never a black screen.

## Shipping it

```bash
npm run build          # → dist/, with public/art/ copied alongside
npm run build:single   # → dist-single/crawler.html, sheets inlined as data URLs
```

The single-file build embeds your PNGs in the HTML, so it keeps the
zero-network-requests promise. It prints how much they added:

```
  + 1 custom art sheet inlined (0.17 MB)
single-file build → dist-single/crawler.html  (5.44 MB)
```

That is the whole cost of custom art: bytes in the bundle. Keep an eye on it
if you replace all nine characters at scale 4.

## Two things this does not do

- **It replaces frames, not behaviour.** Cell sizes change how big a character
  is drawn; they do not change its speed, reach, health or hitbox. Those live in
  `src/config.ts` and are deliberately separate — art and balance should not be
  able to break each other.
- **It is characters and still sprites only.** Terrain, buildings, particles and
  UI are still painted in code (`src/assets/terrain.ts`, `src/assets/atlas.ts`).
  A `sprites` block in the manifest can replace any single-frame atlas entry by
  its exact name — `{ "sprites": { "coin": { "file": "coin.png", "size": [26, 30] } } }`
  — but buildings are baked into their own textures and are not swappable this
  way yet.

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
    shade.ts           Colour maths + the three-tone cel primitive
    figure.ts          The humanoid rig: poses, limbs, heads, weapons
    overrides.ts       Loads replacement PNG sheets from public/art/
    atlas.ts           Canvas2D painters → paged spritesheets, 3/4 view
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
  art-export.mjs       Exports the cast as PNG sheets to repaint
  art-check.mjs        Validates public/art/ against its manifest
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

### The art is one rig and one lighting rule

`assets/shade.ts` holds the whole style: clip to a shape, flood it with the
light tone, re-fill the same path offset away from the light in the base tone,
and once more offset further in the shade tone. One path, three tones, and the
ramp always runs the same way — which is why adding detail anywhere is cheap
and why nothing in the game is lit from the wrong side.

`assets/figure.ts` is the other half: a single articulated humanoid — head,
torso, two arms, two legs, cape — posed from frame data. Carl, a levy, a
redcloak and a Floor Captain are the same skeleton with different materials
and a different thing in its hands. That is not a shortcut. A game whose
characters are each drawn from scratch looks assembled, and at 40 px the thing
that sells a character is its silhouette and its gait, both of which live in
one file.

The walk is driven by **distance travelled**, not by wall time. A cycle on a
clock keeps stepping while a character stands still and slides its feet when it
slows down; on distance, the feet plant at a stop and the cadence rises and
falls with speed for free.

### Where the supersampling goes

Characters get 3×, structures 2×, terrain 1×. That is a deliberate ranking
rather than an oversight: sixteen structures and a few hundred character frames
cost single-digit megabytes at those factors, while supersampling terrain
chunks would cost tens of megabytes for ground the eye slides over. The atlas
packer opens a new page when one fills and crops the last page to the height
actually used, so the art budget is set by what the art needs rather than by a
fixed sheet size.

### Flat things and tall things sort differently

Structures are sprites rather than part of the terrain bake, but only the
castle joins the depth-sorted actor layer. The rest — the muster plaza, the
recruit plates, a camp's scorch circle — are ground decals anchored at their
centre, and sorting those by that centre paints them straight over anything
standing on their near half. That is not a subtle artifact: it was erasing the
companion every time she walked onto the plaza.

### The crowd sorts behind everything

Squad members carry a constant depth penalty. Strictly it is wrong — a levy
standing in front of Carl should occlude him — but sixty near-identical bodies
will otherwise swallow the one the stick is attached to, and "where am I" is
not a question this game should ever ask. Internally the crew still sorts
correctly among itself.

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
