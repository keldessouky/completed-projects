# Slice log

Each slice cuts through every layer (art generator → pack → engine → gameplay → UI → save → tests) and ends
playable. The plan is in [`slices.md`](../../_bmad-output/planning-artifacts/qahira/slices.md). This file records
what each slice actually delivered and how it was verified.

## Slice 0 · First Light

**Delivered**
- **Engine:** the libretro core (GLES 3.2 on Android, GL 4.1 core on the Mac) and `qhost`, the SDL2 dev frontend
  (a window or headless).
- **Renderer:** forward lighting with lights binned into screen tiles (64 per frame), GPU skinning from a bone
  texture, instanced batches, HDR with a six-level bloom, and an ACES-graded composite.
- **UI:** SDF text (Inter), rounded panels, rings and orbs.
- **Asset pipeline:**
  - the Warrior: 15.5k triangles, skinned to the shared 22-bone rig;
  - eight procedural clips: idle, run, slam, swing, warcry, dodge, hit, death;
  - a two-handed maul held through IK;
  - three generated downtown Cairo street tiles with colliders and lights.
- **Gameplay:** the Warrior moves with the stick, slams, swings, warcries and dodge-rolls down a generated street,
  colliding with buildings, lamps and crates. A rumble pulse fires on impact.
- **Save states:** the whole sim state, versioned.

**Verified**

| Check | Result |
|---|---|
| `tools/build_all.sh` regenerates art, pack, Mac build and Android build from scratch | pass |
| All shaders compile as GLSL ES 3.00 (`glslangValidator`) | pass (0 failures) |
| Android core: aarch64, exports all 25 `retro_*` symbols, links only system libraries (GLESv3, EGL, log, android, m, dl, c) | pass |
| Headless bot `walk`: walks up the street, round-trips a save state, asserts distance and restored position | pass (10.5 m) |
| Render check: screenshot at frame 90 | pass (build/screenshot.png) |
| RetroArch on macOS | blocked by a RetroArch macOS driver bug (see ENGINE.md); qhost covers the same API |
| On-device checks (RP6) | pending, see [RP6.md](RP6.md) |

## Slice 1 · One Fight

**Delivered**
- **Stat engine:** the modifier engine and the damage pipeline (GDD §8), with golden unit tests in `qtests`.
- **Ghouls:** generated with eight clips, as three kinds:
  - a swarmer that claws;
  - a Grave Bruiser that does a telegraphed two-armed slam;
  - a Bile Spitter that kites and leads its shots.

  Rares roll two mods, a generated name and a gold rim.
- **Warrior kit:**
  - **Crushing Blow:** every third hit in a row cracks the ground.
  - **Earthshatter:** a slam that leaves three cracks.
  - **Rallying Shout:** builds Break in nearby enemies and gives 40% more damage on the next three hits.
  - **Aftershock:** detonates every crack in range.
  - **Dodge roll**, and a **life flask** on the rear button (M1 → L3).
- **Break:** hits fill a meter; when it's full the target is stunned, then takes 50% more damage.
- **Hit feel:** hit-stop, camera shake, knockback, hit flashes and rumble.
- **Items:**
  - item bases and tiered affixes, with generated rare names;
  - drops and loot beams;
  - a tooltip that shows the DPS change against the equipped weapon;
  - equip with the D-pad.
- **XP and levels.** Death shows "You fell in the long night" and lets you rise again at the start.
- **HUD:** life and mana orbs, a skill bar with position-based button glyphs, a rare target frame with mods and a
  Break meter, crit numbers, loot labels.
- **Location:** a generated Khan el-Khalili souq with lamps, lantern racks, spice sacks, brass trays and mashrabiya.
  The fight runs from the street into the souq.
- **Sound:** all synthesised; 19 effects, Cairo night ambience, and a maqam Hijaz loop on oud, qanun, ney, darbuka
  and riq. A 32-voice mixer in the core.
- **Save states:** the whole world state.

**Verified**

| Check | Result |
|---|---|
| Unit tests (`qtests`) | pass, 6 golden cases |
| `fight` bot: clears all 18 ghouls including the rare, equips its rare drop, round-trips a save state mid-fight | pass (level 3, 0 deaths) |
| `walk` bot | pass |
| Audio capture during the fight (`--wav`) | peak 0.78, RMS −21 dBFS, no clipping |
| Shaders as GLSL ES 3.00 | pass |
| Android core builds | pass |
| On-device feel review | pending (RP6) |

## Slice 2 · One Zone

*From the rooftop hub down into the City of the Dead, through Umm al-Ghūla, and home.*

**Delivered**
- **The rooftop ahwa (hub):**
  - Amm Sayed, the ahwa keeper, on the shared rig with an idle clip, beside his counter; a street cat;
  - the stair down to the zone, and the town portal back when one is open;
  - a fade between areas, the area's name as a banner, and its own music and ambience.
- **The City of the Dead (zone):**
  - generated per visit on a 4×6 grid of 16 m cells: a biased random walk from the entrance gate to the boss court,
    three side branches, and a landmark;
  - cells are built from seven canonical necropolis tiles (end, straight, corner, tee, cross, entrance, court),
    two variants each, rotated in quarter turns;
  - the landmark is an open court around a qubba (a small domed canopy on four columns) over an old cenotaph, with
    a sabil basin. It holds the Lamplighter's cache, guarded by a rare pack;
  - branch dead ends hold rare or magic packs; monster density rises with depth.
- **Umm al-Ghūla, Mother of the Ghouls (boss):**
  - a new rig variant (2.45 m, hunched) with hair, a tattered shroud, a necklace of bones and talons, and eight
    clips;
  - phase 1: claw combos (telegraphed cone, two hits) and leap-slams (telegraphed landing, clamped to her court);
  - at 55% life she summons five ghouls from the graves ("Rise, my children");
  - phase 2: 25% faster, and a wail every 11 s (7.5 m, chaos damage scaled to the hero's life) that leaves her
    exhausted, a 3 s Break window;
  - Break builds at half rate and lasts longer. She keeps to her court: if the hero truly escapes (or dies) she
    walks home and heals;
  - she drops four items, four currencies (always a Gilded Piastre) and a heap of dinars; an exit portal opens in her
    court.
- **Belongings:**
  - a 12×5 inventory, with PoE item sizes (a maul is 2×4, a ring 1×1) and column-first placement;
  - a nine-slot paper doll (two rings);
  - five crafting currencies. They carry street names but do plain PoE jobs, and the tooltip always says which:
    Blue Bead (transmute), Pinch of Salt (augment), Coffee Grounds (alteration), Saffron Thread (alchemy), Gilded
    Piastre (regal);
  - dinars (gold). Currency and dinars drop as their own ground loot and are picked up by walking over them.
- **Loot filter:** Story, Standard, Strict and Uber presets, switchable in the menu or with D-pad Right in the field.
  Hidden items are not drawn, labelled or selectable.
- **Menu hub (Start):**
  - Inventory, Character and Loot Filter tabs on L1/R1;
  - a cursor that walks cells and treats each item as one stop;
  - item cards with the ±DPS against what you wear, and the equipped piece beside them;
  - South to equip, unequip or use a held currency; North to drop;
  - the world pauses while it's open.
- **Vendor:** Amm Sayed's wares, nine items restocked on each visit, beside your belongings. Sell from your
  inventory, and buy items or currency with dinars.
- **Portal and map:**
  - D-pad Up opens a town portal. The zone instance stays alive, with its monsters, loot and cache, while you're on
    the rooftop, and the portal leads back to the same spot;
  - D-pad Down toggles an overlay map of explored cells, fogged neighbours, the portal, the exit, the cache and the
    boss.
- **Death:** you rise at the zone entrance. A boss you were fighting heals and returns to her court, and her brood
  sinks back into the ground.
- **Character file:** `qahira.character` in RetroArch's save directory. It holds level, XP, equipment, inventory,
  currency, dinars and the filter preset. It's written atomically when you arrive home, close the menu, level up
  or quit.
- **Save states v4:** add the areas, the kept zone instance, interactables and the boss's phase and home. The level
  and NPCs are rebuilt from the saved layout on load.
- **Engine:**
  - an A* nav grid on the level (0.5 m cells rasterised from the colliders, string-pulled paths);
  - distance culling of level tiles;
  - NPC collision.
- **Fix:** skills now aim where the stick points. Before, they aimed where the body faced, which after a dodge is
  the roll direction, so the next swings hit empty air. The zone bot found it: fixing it took the run from 3 deaths
  in 418 s to 0 deaths in 163 s.
- **Audio:**
  - the necropolis night (wind, crickets, a far dog);
  - a maqam Saba zone theme on qanun;
  - a driving boss track in Kurd at 128 bpm;
  - ten new effects: portal, dinars, currency, craft, sell, inventory full, the chest, her wail, her leap, and the
    summoning.

**Verified**

| Check | Result |
|---|---|
| Unit tests (`qtests`) | pass, 12 cases (6 new: inventory placement, every currency's rules, mask rotation, 300 generated zones are connected with dead-end courts, the nav grid, the character file round trip) |
| `zone` bot: a fresh character goes hub → stair → zone, portals home and back to the same streets, opens the cache, fights Umm al-Ghūla (with a save state round trip mid-fight, in phase 2), takes the exit portal home, sells to and buys from the vendor (checking the arithmetic), and round-trips the character file | pass (13 cells, level 5, 71 kills, 0 deaths, 163 s of game time) |
| `fight` bot, now equipping through the inventory menu | pass (18 ghouls, 0 deaths) |
| `walk` bot, now on the rooftop | pass |
| `tour` (screenshots of every screen) | rooftop, inventory, character sheet, filter, vendor, zone, map, boss |
| Shaders as GLSL ES 3.00; Android core builds | pass |
| On-device feel review | pending (RP6) |

| | |
|---|---|
| ![The rooftop ahwa](img/slice2-hub.jpg) | ![Inventory with an item card and the equipped comparison](img/slice2-inventory.jpg) |
| ![Amm Sayed's wares](img/slice2-vendor.jpg) | ![Umm al-Ghula, Broken, under a lamp in the City of the Dead](img/slice2-boss.jpg) |

**Known gaps (carried forward)**
- Monsters still chase in straight lines. The nav grid exists, but only the bots use it so far.
- Items still have no unique bases. Uniques come with the Act I content in Slice 4.
- The boss tuning comes from the bot, which is a middling player. It needs a human pass on the device.

## Slice 3 · One Sky (in progress)

Handed off on 2026-09-27. The passive tree's layout tool and validator, and its runtime (allocation rules,
keystones, Hirz, build codes and the character file v2), are committed and tested. The tree screen, the Sorcerer,
the Wafq supports, the DPS breakdown, the build simulator and the exit bot are still to do. The details are in the
[handoff notes](HANDOFF.md).
