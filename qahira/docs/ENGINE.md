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

**Areas.** `Areas` owns the current area (the hub, the necropolis, or the Slice 1 street, kept as a combat range)
and one **zone instance**:
- **Leaving by portal** snapshots the instance's live monsters (reset to idle), loot and interactables.
- **Returning** by the stair or a portal restores them, so the streets are as you left them.
- **The instance ends** when you take the exit portal after the boss.

The zone's level is the hero's level + 1, clamped to 2–8.

**Interactables** (stair, portal, vendor, exit, chest) are plain data in the `World`. South uses the nearest one in
reach when no enemy is within 6 m. The app turns the result into a fade-out → travel → fade-in, or it opens the
vendor or the chest.

## Belongings, the menu and the vendor (`game/inventory.*`, `game/menu.*`)

- **Inventory:** 12×5 cells. Item sizes come from the slot (maul 2×4, body 2×3, helmet/gloves/boots 2×2, belt 2×1,
  jewellery 1×1). New items go to the first space scanning columns left to right, then rows, as in PoE.
- **Equipment:** nine slots. An empty `Item` has the base `kNoItem`, and its `b()` returns a harmless placeholder.
  Equipping swaps the old piece into the new one's spot, or anywhere else it fits, or refuses.
- **Currency:** five crafting currencies with PoE rules (transmute, augment, alteration, alchemy, regal) share
  `roll_affix`, which respects prefix/suffix limits: magic 1+1, rare 3+3. Dinars pay the vendor.
- **Loot filter:** four presets. A hidden item is not drawn, labelled or selectable; currency and dinars always
  show, and you pick them up by walking over them.
- **Menu:** paused, controller-first.
  - The cursor walks cells and hops over whole items.
  - Up from the grid goes to the paper doll, down to the purse, and left to the vendor's wares.
  - Item cards show ±DPS against what you wear, with the equipped piece beside them.
  - Icons are vector silhouettes per slot, tinted by rarity, so no textures are needed.

## The boss (`World::boss_step`)

Umm al-Ghūla has her own state machine instead of the generic chase-and-strike:
- **Combo:** a two-hit claw combo with a 70° cone telegraph.
- **Leap:** a leap-slam at range. She travels along a curve during the airborne frames, and her landing is
  telegraphed and clamped to 9 m of her court.
- **Summon:** at 55% life she summons five ghouls.
- **Wail:** in phase 2, a 7.5 m wail that leaves her stunned and Broken.

Every strike resolves on its clip event, as the hero's skills do. She is leashed to her court: once engaged she
follows up to 26 m, and if the hero goes further, or dies, she walks home, heals and resets her phase.

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
and dodges out of telegraphs. Three bots run in `tools/build_all.sh`:
- `walk` moves on the rooftop and round-trips a save state.
- `fight` clears the Slice 1 street, including the rare, and equips upgrades through the inventory.
- `zone` is the Slice 2 exit test: hub → zone → a portal round trip, checking the zone is unchanged → the cache →
  the boss, with a save state mid-fight → the exit portal → the vendor, checking the arithmetic → a character file
  round trip.

`tour` is not a test; it poses every screen for screenshots. Set `QAHIRA_BOT_TRACE=1` to print what a bot is
doing every five seconds.

## Audio (`audio/`)

A 32-voice software mixer at 48 kHz stereo. It has linear-interpolated resampling (for pitch variation), constant-power
panning, two crossfading music beds and two ambience beds, and a soft limiter. Sounds are 16-bit mono WAVs from the
pack, all synthesised by `tools/audio/synth.py` (see ASSETS.md). `qhost --wav out.wav` records the mix for checks.

## Saves

There are two kinds:

- **Save states (`retro_serialize`, version 4).** A versioned byte stream (`core/serial.hpp`, `game/save.cpp`) of
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
- **The character file (`qahira.character` in the frontend's save directory).** It holds level, XP, kills, dinars,
  currency, skills, the filter preset, equipment and the inventory, with its own magic and version. It is written to
  a temporary file and renamed, when you arrive in the hub, close the menu, level up, kill the boss, or quit. An
  unreadable file is kept as `.bad` and a fresh character starts. Bots never touch it.

## Known platform notes

- **RetroArch for macOS (the 1.22 Homebrew build)** can't host this core. Its only GL driver is the legacy `gl`
  driver, which fails with "Invalid enum" while creating its own framebuffer for any core-profile GL core, before
  the core draws anything. The device path, RetroArch for Android with GLES 3.2, uses a different context, and it's
  the same path the GLES cores PPSSPP and Flycast use. On the Mac, use `qhost`.
- The core asks for no depth or stencil in the frontend framebuffer. It renders into its own targets and only
  composites into the frontend's.
