# Engine

A purpose-built C++20 engine, "Mashrabiya", shipped as a **libretro core**. It targets one device: the Retroid
Pocket 6, with its Adreno 740 and a 1080p 120 Hz AMOLED, running GLES 3.2 through RetroArch for Android. The same
code builds for macOS (GL 4.1 core) for development.

## Layers

```
platform/libretro_core.cpp   retro_* entry points: HW context, RetroPad -> Input, fixed-step loop, save states
platform/app_api.hpp         the only interface between libretro and the game (app_init, app_update, app_render, ...)
game/                        the game (the app_* functions live in game/app.cpp)
ui/                          SDF text + shapes in a 1920x1080 logical space
gfx/                         GL wrappers, renderer, meshes, shaders
anim/                        skeletons, sampled clips, poses
core/                        math, pack reader, JSON, byte streams, logging
host/qhost.cpp               SDL2 libretro frontend for the Mac (window or headless); links the core directly
```

The game never calls libretro or SDL. `qhost` implements the same frontend contract as RetroArch:
- `SET_HW_RENDER` hands the core a GL context and framebuffer.
- Input arrives through `input_state`.
- The core's audio output is queued to SDL.

So what runs in qhost is what runs on the device, except for the GL flavour.

## Frame

`retro_run` does four things, in order:
1. It polls the RetroPad. The analog triggers and pointer (touch) come from their dedicated libretro indices.
   Face buttons are named by position (south, east, west, north), because the RP6 can swap its labels.
2. It calls `app_update(input, 1/60)`. This is one fixed simulation step, so the simulation is deterministic, bot
   runs replay exactly, and save states are just the sim state.
3. It calls `app_render(fbo, 1920, 1080)`, rendering into the framebuffer the frontend provides.
4. It hands 800 stereo samples (48 kHz / 60) to the frontend.

## Renderer (`gfx/renderer.*`)

It's a forward renderer that bins lights into screen tiles, because the city at night is lit by dozens of small
lights (neon, lanterns, lamps).

1. **Tiling (CPU):** each point light's bounding box is projected to the screen and binned into a 16×9 tile grid.
   The per-tile light lists go into an `R8UI` texture (a count plus 31 indices per tile). Up to 64 lights per frame
   go in a UBO.
2. **Scene pass:** draws into an `RGBA16F` target at 0.75× scale (1440×810) with depth.
   - Meshes are batched by type and drawn with `glDrawElementsInstanced`.
   - Per-instance data holds the model matrix, a tint, the skinning-palette offset, a hit flash, a dissolve amount
     and a rim light.
3. **Skinning:** on the GPU. Bone matrices (3×4) for every animated instance are packed into one `RGBA32F` texture
   each frame, and each instance carries its palette offset. That's one draw call per mesh type however many
   monsters share it.
4. **Shading:**
   - GGX specular with Lambert diffuse.
   - Hemisphere ambient, weighted by the baked per-vertex AO.
   - A low violet "sun" (dusk light) plus the tile's point lights.
   - Rim light: amber for the player, magenta for enemies.
   - Emissive materials, and distance fog.
5. **World sprites:** soft discs, rings, sectors and glows (for decals, telegraphs, particles), in an alpha pass
   and an additive pass.
6. **Bloom:** a 13-tap downsample chain (six levels) with a soft threshold, then a tent-filter upsample.
7. **Composite:** into the frontend's framebuffer at 1920×1080. Scene plus bloom, then exposure, the ACES filmic
   curve, lift/gain/saturation grading, vignette, sRGB conversion, and dithering.
8. **UI:** drawn on top at native resolution (see below).

Every shader is written in the common subset of GLSL ES 3.00 and GLSL 3.30. `tools/check_shaders.py` compiles all
of them as ES 3.00 with Khronos' `glslangValidator`, which is how the RP6 path is checked without the device.

## Animation (`anim/`, `game/animator.hpp`)

- Skeletons share one humanoid layout of 22 bones (`tools/art/qart/rig.py`). Every bone's bind frame is
  axis-aligned with the character (Z up, facing −Y), so clip data is plain local rotations, and any skeleton with
  the same bone names can play the same clips.
- Clips are sampled at 30 fps, with linear/nlerp blending between frames and named events (e.g. `hit` at the
  impact frame).
- `Animator` crossfades between clips and fires each event once per play.

## UI (`ui/`)

- Text uses signed-distance-field glyphs rendered by stb_truetype at startup (Inter, OFL). The same atlas draws any
  size crisply; bold is a threshold shift, and outlines come from the distance field.
- Shapes are analytic in the fragment shader: rounded rectangles and rings (for the orbs).
- Clipping uses scissor markers inside the vertex stream, so everything draws in submission order.

## Levels (`game/level.*`)

A level is a set of placed tiles. Each tile has two parts, both generated in Blender:
- a static mesh, and
- a JSON sidecar listing its colliders (axis-aligned boxes), light sources, and named points (`spawn`, `stair`,
  `keeper`, `chest`, ...).

Tiles can be placed rotated by quarter turns; colliders, lights and points rotate with them. Characters collide as
circles against the boxes, pushed out along the shortest axis. Tiles more than about 30 m from the camera's focus
are not drawn, and lights within 28 m of the player are submitted each frame, with a slight flicker.

**Navigation.** `Level::find_path` runs A* over a 0.5 m grid rasterised from the colliders, grown by the walker's
radius. It is built on first use and rebuilt whenever tiles change. Moves are 8-connected, with no corner cutting.
The result is string-pulled along grid line-of-sight into a few straight legs. The bots use it today. Monsters
will switch to it when they get smarter pursuit.

## Zones and areas (`game/zone.*`, `game/areas.*`)

**Generation.** A zone is a grid of 16 m cells:
1. A biased random walk goes from a gate on the bottom row towards the top, mostly north with some east/west
   drift; its last cell becomes the boss court.
2. Side branches of 1–2 cells grow off the main path, never off the gate or the court.
3. The deepest branch dead end becomes the landmark.

Each cell stores an opening mask (N=1 E=2 S=4 W=8). `build_zone_level` picks the canonical tile whose mask, rotated
by 0–3 quarter turns counter-clockwise, matches: end, straight, corner, tee or cross, in two variants. The gate,
court and landmark have their own tiles. A unit test generates 300 zones and checks that every opening is mutual,
every cell is reachable from the gate, and the court and landmark are dead ends.

**The campaign (`game/acts.*`).** Each zone is a `ZoneDef` row: its region's tiles, area level, grid size and
branches, music and ambience, weighted spawns and an elite, its boss and the banner when it falls, the zone its far
court leads to, what its landmark holds (a cache, the bench, or the old cinema's posters), an optional side zone, and
whether it is a trial with a toll. Act I runs Downtown (2) → the Metro (4) → Khan el-Khalili (5) → al-Muizz (7,
with the Bab Zuweila trial at 8 off its far court) → the City of the Dead (10) → the Mokattam cliffs (12). The
table is append-only: waypoints are stored by index.

- **Waypoints** stand at every zone's entrance. Touching one (or arriving) records it; a waypoint, or the rooftop
  stair, opens the list of zones you can travel to. Killing a boss also records the waypoint of the zone it leads to.
- **The way on:** when a boss falls, its court opens a *Next* gate to the next zone, a *Gate* to a side zone, or an
  exit home at the act's end.
- **Trials:** entering one moves the equipment in its toll slot (Bab Zuweila takes the amulet) into `Hero::sealed`.
  Leaving the zone by any means gives it back (to its slot, the bags, or the slot again if the bags are full).
- **Quests** are bits in `Hero::quests`; some grant passive points (`quest_passive_points`) or ascendancy points.
- **Regions (`tools/art/env/kit.py`, `regions.py`):** every region shares one cell kit (end, straight, corner, tee,
  cross in two variants; entrance, arena, landmark) built from lane and block rectangles, so any cell joins any other.
  A unit test builds twenty layouts per zone from the generated tiles and walks from the entrance to every cell on the
  nav grid.

**Areas.** `Areas` owns the current area (the hub, a campaign zone, or the Slice 1 street, kept as a combat range)
and one **zone instance**:
- **Leaving by portal** snapshots the instance's live monsters (reset to idle), loot and interactables.
- **Returning** by the stair or a portal restores them, so the streets are as you left them.
- **The instance ends** when you take the exit portal after the boss.

A zone's monster level is its `ZoneDef` area level. XP from a kill grows 30% per area level and falls off once the
hero is more than two levels above the area.

**Interactables** (stair, portal, vendor, exit, chest) are plain data in the `World`. South uses the nearest one in
reach when no enemy is within 6 m. The app turns the result into a fade-out → travel → fade-in, or it opens the
vendor or the chest.

## Belongings, the menu and the vendor (`game/inventory.*`, `game/menu.*`)

- **Inventory:** 12×5 cells. Item sizes come from the slot (maul 2×4, body 2×3, helmet/gloves/boots 2×2, belt 2×1,
  jewellery 1×1). New items go to the first space scanning columns left to right, then rows, as in PoE.
- **Equipment:** nine slots. An empty `Item` has the base `kNoItem`, and its `b()` returns a harmless placeholder.
  Equipping swaps the old piece into the new one's spot, or anywhere else it fits, or refuses.
- **Currency:** PoE's rules under street names, sharing `roll_affix` (prefix/suffix limits: magic 1+1, rare 3+3):
  - Blue Bead, Pinch of Salt, Coffee Grounds, Saffron Thread, Gilded Piastre (transmute, augment, alteration,
    alchemy, regal); Khamsa (exalt), Bakhoor Ash (annul then exalt), Broken Tea Glass (annul), Drop of Attar (divine,
    uniques included) and the Ifrit's Ember (corrupt: unchanged, an implicit, one mod ×1.3, or remade as a rare; either
    way it is sealed);
  - **Spice Blends** add a mod from one family (fire, cold, lightning, life, caster, physical attack); a full magic
    item becomes rare to make room;
  - **Coffee-Cup Omens** are read from the purse, not used on an item, and bend the next craft: the Bird (a suffix),
    the Fish (a prefix), the Closed Door (Glass and Ash spare bench mods), the Crescent (the Ember cannot remake it);
  - currencies have a minimum area level, so the rarer ones arrive over the act. Dinars pay the vendor and the bench.
- **The Coppersmith's Bench (`game/crafting.*`):** Usta Hassan's recipes add one exact mod (the middle of a tier) for
  dinars; an item carries one bench mod (`AF_CRAFTED`), and it can be taken off. Three recipes come with the bench;
  each Act I zone's cache and boss teaches another (sixteen in all).
- **Uniques and Poster Scraps (`game/uniques.*`):** twenty uniques, each the prop of an invented golden-age Egyptian
  film. Their mods use the generic affixes (`AE_GENERIC`: one stat, kind and tag set; they never roll on drops).
  Scraps drop from bosses, rares and the Downtown billboard; the fourth scrap of a poster gives you its unique.
- **Loot filter:** four presets. A hidden item is not drawn, labelled or selectable; currency and dinars always
  show, and you pick them up by walking over them.
- **Menu:** paused, controller-first.
  - The cursor walks cells and hops over whole items.
  - Up from the grid goes to the paper doll, down to the purse, and left to the vendor's wares.
  - Item cards show ±DPS against what you wear, with the equipped piece beside them.
  - Icons are vector silhouettes per slot, tinted by rarity, so no textures are needed.

## Bosses (`BossDef`, `World::boss_step`)

Every boss is a row of moves (`boss_def`): a kind, the clip it plays, a cooldown, a range band, a damage multiplier
and the phase it unlocks in; a phase-2 threshold and banner; what it summons and how many; its court's leash; its
haste in phase 2; its bolt colour. The move kinds:
- **Combo:** a two-hit strike (`hit`, `hit2`) with a cone telegraph.
- **Leap:** a telegraphed leap-slam along a curve, its landing clamped to the court.
- **Summon** and **Wail** (a stun-and-Break roar), usually from phase 2.
- **Charge:** a telegraphed line dash (the Iron Microbus). **Nova:** a ring around it. **Volley:** a fan of five bolts.
- **Blink:** it vanishes and steps out beside you. **Pools:** three burning pools under and around you.

Strikes resolve on clip events; a **rigid** monster (a possessed object: one static mesh) uses fixed timings instead.
Six bosses use it: Umm al-Ghūla, the Iron Microbus, the Si'lah of Sadat Station, al-Nasnas al-Kabir, the Ifrit of Bab
Zuweila and the Qutrub of the Quarries. Bosses are leashed to their court and heal when the hero escapes or dies.

Ordinary monsters now path on the nav grid (A*, refreshed every 0.6–0.9 s); leapers telegraph a landing circle, and
the dish's beam telegraphs its line.

## Gameplay (`game/world.*`, `game/stats.*`, `game/items.*`)

The `World` is plain data, stepped at a fixed 60 Hz:
- `actors[0]` is the hero; the rest are monsters.
- It also holds projectiles, ground effects (cracks, telegraphs, rings), loot on the ground, and particles.

**Stats.** Every number comes from the modifier engine (see GDD §8). A mod is (stat, flat / increased / more,
value, required tags); a query context picks up every mod whose tags it carries. `compute_hit` runs the pipeline
in this order: base → added → increased (summed) → more (each multiplied) → crit. `roll_hit` then applies armour
(A/(A+10D), capped at 90%) and resistances (capped at 75%). The golden tests are in `tests/test_stats.cpp`.

**Skills.** Skills are table rows (`skill_defs`): tags, clip, effectiveness, mana cost, cooldown, and shape (cone,
circle, detonate, warcry). A skill resolves on its clip's `hit` event, so animation and damage never drift apart.
Attack speed scales the clip. Aim assist bends the swing towards the best target in a 40° cone.

**Monsters.** Each monster runs a small state machine: idle → chase → windup (a ground telegraph sized to the
attack) → strike on the clip event → recover. Spitters keep their distance and lead the hero with bile. Rares
roll two mods (Hasted, Armoured, Frenzied, Vampiric), get a gold rim, and drop a rare weapon.

**Break.** Hits fill a Break meter in proportion to damage over maximum life. When it's full, the target is stunned
for 1.4 s and then takes 50% more damage for 3 s. Rallying Shout and slams build Break faster.

**Items.** A base plus affixes, where each affix is a tier gated by item level with rolled values:
- Local mods (added or increased physical, attack speed, crit, armour) fold into the item itself.
- Every other mod becomes a global modifier on the hero.
- Tooltip text is generated from the structured mods.
- The tooltip shows the DPS change against the equipped weapon.

**Events.** The simulation never calls presentation code. It appends `Event`s (Swing, SlamImpact, EnemyDie, Break,
LevelUp and so on) that the app turns into sound, rumble and light flashes after each step.

**Bots (`game/bots.*`).** A bot drives the game through the same `Input` a player produces, menus included: it
opens the inventory with Start and walks the cursor with the D-pad to equip or sell. It moves along nav-grid paths
and dodges out of telegraphs. The Sorcerer's pilot keeps its distance, lays a glyph under a pack, chains Arc into
crowds and calls the star down on anything chilled. These bots run in `tools/build_all.sh` and CI:
- `walk` moves on the rooftop and round-trips a save state.
- `fight` clears the Slice 1 street, including the rare, and equips upgrades through the inventory.
- `zone` is the Slice 2 exit test: hub → zone → a portal round trip, checking the zone is unchanged → the cache →
  the boss, with a save state mid-fight → the exit portal → the vendor, checking the arithmetic → a character file
  round trip. `sorcerer` runs the same as the Sorcerer.
- `sky` is the Slice 3 exit test: 30 stars planned on the sticks and placed in under two minutes, a paid respec, and a
  build code round trip.
- `title` makes a character from the title screen, deletes it, and makes another.

`tour` and `tour3` are not tests; they pose every screen for screenshots. Set `QAHIRA_BOT_TRACE=1` to print what a bot is
doing every five seconds.

## Classes, skills and supports (`game/classes.*`, `game/skills.*`)

- **Classes** are a table: base attributes, life, mana, Hirz, armour, the starting weapon, four starting Talismans, the
  model. The class also sets the start in the sky. The Warrior and the Sorcerer are playable.
- **A Talisman** is a skill (a row in `skill_defs`) with a level, 2-5 Wafq slots and an attribute requirement
  (8 + 3.4 per level of its attribute). Spells scale their base damage by 12% a level, attacks their effectiveness by
  4%. The hero carries any number of Talismans; two bars of five point at them (hold L2 for the second).
- **Shapes:** cone, circle, detonate and warcry (the Warrior's), and projectile, chain, glyph and meteor (the
  Sorcerer's). A skill resolves on its clip's `hit` event. Ground-targeted spells land on the enemy they were aimed at,
  or short of full reach; the right stick overrides the aim.
- **A Wafq** (support) adds modifiers to a copy of the hero's stats for that one skill, sourced `SRC_WAFQ + id`, and
  multiplies the mana cost. `skill_ctx` works a Talisman out once: stats, the hit, mana, cooldown, speed, area,
  projectiles, chains and ailment chances. The HUD, the Talismans tab, the tree's stat delta, the build simulator and
  the cast all use it, so they cannot disagree.
- **Ailments** on monsters: Ignite (90% of the fire hit per second for 4 s), Chill (30% slower, scaled by Freeze
  modifiers), Freeze (a meter filled by cold damage over life; full, they stop for 1.6 s, bosses 0.8 s) and Shock (20%
  more damage taken for 4 s, scaled by Shock effect). Chill slows the monster's whole step, animation included.
- `World::hit_enemy` is the one place a hero hit lands: mitigation, keystones, crit text, leech, ailments, Break and
  knockback. Projectiles, glyph pulses and falling stars carry a `HeroHit` (the worked-out hit and chances) so a save
  state restores them exactly.

## The Book of Fixed Stars (`game/tree.*`, `game/sky.*`)

- `tools/tree/build_tree.py` lays the tree out and validates it; `data/tree.json` holds the stars, edges,
  constellations and each class's Recommended Path.
- An `Allocation` follows PoE's rules. Held stars' mods join the hero's stats (`SRC_STAR + id`).
- The screen stages changes in a copy of the allocation; Start applies them (and charges for refunds after level 20).
  The plan is a list of stars in an order that can be taken, kept in the character file.
- The stat delta compares two `HeroSummary`s (`summarize`), computed without touching the live hero.
- Build codes: `Q1<class>-<held stars as base-32 bits>-<checksum>`. `ui/qr.*` draws them as QR codes.

## The menu's Talismans and Character tabs (`game/menu_tabs.cpp`)

- **Talismans:** rows for the ten bar slots and the Blank Talismans; columns for the Wafq slots and the Stylus "+".
  South opens a picker: a Talisman for a slot, a Wafq for a slot, or a skill to carve a Blank into.
- **Character:** a cursor over every number. "Why?" lists the modifiers behind it with their sources; the main
  skill's DPS is laid out as the pipeline (base, added, gain as extra, increased, more, crit, speed).

## The title screen (`game/title.*`)

Four slots (`qahira_1.character` ... `qahira_4.character`; a Slice 2 `qahira.character` becomes slot 1). A new
character picks a class. Bots skip the title, except the `title` bot, which uses its own save folder.

## Audio (`audio/`)

A 32-voice software mixer at 48 kHz stereo. It has linear-interpolated resampling (for pitch variation), constant-power
panning, two crossfading music beds and two ambience beds, and a soft limiter. Sounds are 16-bit mono WAVs from the
pack, all synthesised by `tools/audio/synth.py` (see ASSETS.md). `qhost --wav out.wav` records the mix for checks.

## Ascendancy (`game/asc.*`)

Each class's inner sky: thirteen nodes, six minor→notable pairs round a start. The Trials of Ascendancy give two points
each (Bab Zuweila is Trial I). Notables carry mods and rules (`AscRule`, alongside the tree's keystones):
- **Ironclad** (Warrior): Endurance Charges (gained on Break or from warcries; each is 4% less physical damage taken
  and +4% elemental resistances; they fall off after 10 s), no knockback, armour against elemental hits, slams that
  punish Broken enemies, life regeneration per charge.
- **Stormbinder** (Sorcerer): spell crits always Shock, chilled and frozen enemies take more damage, more Ignite
  damage, spell crit, Hirz, and chains.

A node needs its parent; a refund costs a Rosewater Vial.

## The Journal and the codex

The menu's Journal has three sections: quests (done or not, and their rewards), the codex (an entry the first time you
meet each monster family and each mechanic: waypoints, the trial, the bench, Blends, Omens, the Ember, posters and the
ascendancy), and the posters (every film, the scraps you hold, and the poster drawn with its missing quarters torn).
New entries, learned recipes and finished posters show as toasts in the field.

## Saves

There are two kinds:

- **Save states (`retro_serialize`, version 7).** A versioned byte stream (`core/serial.hpp`, `game/save.cpp`) of
  the whole simulation:
  - every actor, including life, Break, AI state, boss phase and home, animation clip, time and fired events;
  - projectiles, ground effects, and ground loot (items, currency, dinars);
  - interactables;
  - the character record (below), plus cooldowns and the flask;
  - the areas, including the kept zone instance and its layout;
  - the RNG state and the camera.

  On load, the level geometry and NPCs are rebuilt from the saved area and layout. Particles and floating text are
  cosmetic and aren't saved. RetroArch's save states and auto-resume therefore work anywhere, including mid-boss.
  The bots check this by saving, changing the state, restoring, and comparing.
- **The character file (`qahira_<slot>.character` in the frontend's save directory, version 4).** It holds level, XP,
  kills, dinars, currency, the class and its stars, the plan, Talismans, the bars, Wafq, Blank Talismans, the filter
  preset, equipment and the inventory, with its own magic and version. Version 4 adds Act I: waypoints, quests, the
  trial's sealed item, recipes, the codex, read Omens, ascendancy nodes and Poster Scraps; its items carry corruption,
  their unique and each mod's bench/implicit flag (item format 2). Versions 1–3 still load (a unit test reads a
  hand-written version 3 file). It is written to
  a temporary file and renamed, when you arrive in the hub, close the menu, level up, kill the boss, or quit. An
  unreadable file is kept as `.bad` and a fresh character starts. Bots never touch it.

## Known platform notes

- **RetroArch for macOS (the 1.22 Homebrew build)** can't host this core. Its only GL driver is the legacy `gl`
  driver, which fails with "Invalid enum" while creating its own framebuffer for any core-profile GL core, before
  the core draws anything. The device path, RetroArch for Android with GLES 3.2, uses a different context, and it's
  the same path the GLES cores PPSSPP and Flycast use. On the Mac, use `qhost`.
- The core asks for no depth or stencil in the frontend framebuffer. It renders into its own targets and only
  composites into the frontend's.
