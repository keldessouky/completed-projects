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

## Slice 3 · One Sky

*The Book of Fixed Stars, first draft, with a second class.*

**Delivered**
- **The passive tree, v1** (`tools/tree/build_tree.py`, `game/tree.*`):
  - 131 stars laid out as the real sky: the Pole, Draco round it, the Ecliptic, eleven constellations drawn from their
    star patterns with Arabic star names as notables, and two lunar-mansion keystones (al-Dabaran, al-Simak);
  - the validator (reach, keystone distance, spacing, no crossing edges, notable power bands, stat hoarding) fails the
    build, and now also checks each class's **Recommended Path** (the Warrior's takes 21 points, the Sorcerer's 24);
  - PoE's allocation rules, keystones, Hirz (energy shield) and checksummed build codes.
- **The Stars screen** (`game/sky.*`), on hold of Select, with the world paused:
  - a magnetised stick cursor that jumps to the nearest star in the push direction, and D-pad walking along edges;
  - right stick to pan, L2/R2 through three zooms, L1/R1 between planned notables;
  - South previews the cheapest path with its cost and a stat delta (DPS of the main skill, life, Hirz, mana, armour,
    EHP, resistances, attributes), and again to stage it. Start applies, East cancels;
  - **the planner**: West plans a path in turquoise ghost stars, and West on a planned star cuts the plan there. In the
    field a tap of Select places the next planned star (the HUD names it), so a level-up is one press;
  - **search** by keyword chips (Life, Hirz, Fire, Spell, Keystone ...): matching stars glow;
  - **respec**: South on a held star stages a refund if the rest stays connected. It is free before level 20; after,
    each refund costs a Rosewater Vial and 5 dinars per level;
  - **build codes** as text and a **QR code** (`ui/qr.*`: byte mode, level M, versions 1-10, mask by penalty); import
    a code with an on-screen keyboard (it becomes a plan), or plan the class's Recommended Path in one press;
  - **touch**: tap a star to aim at it, tap again to act; drag to pan.
- **The Sorcerer**, a second class (`game/classes.*`):
  - generated on the shared rig (`tools/art/characters/sorcerer.py`): an astronomer in a long plum coat and a turquoise
    head wrap, round brass glasses, a satchel of star charts; 10.9k triangles and ten clips;
  - her staff: ashwood with a brass astrolabe head (mater, rete and pointers) and a lamp of turquoise light;
  - **four Talismans**, set up and pay off: *Ember Bolt* (fire projectile, can Ignite), *Arc* (lightning that chains
    three times, can Shock), *Frost Glyph* (a glyph that Chills and pulses cold; spells cast inside it deal 30% more),
    and *Falling Star* (a delayed impact: 60% more to Chilled or Frozen enemies, and a glyph it lands in bursts for three
    pulses at once);
  - Intelligence, Hirz and spell damage on staves and on new armour bases; eight new sounds for the spells.
- **Talismans and Wafq** (`game/skills.*`), PoE2's gem model:
  - a Talisman has a level, an attribute requirement and 2-5 Wafq slots; two bars of five (hold L2 for the second);
  - **six Wafq**, each drawn as its real magic square, the planetary squares of the old books: Saturn (30% more
    damage), Jupiter (gain 25% as extra Fire), Mars (20% more speed), the Sun (area), Venus (+2 projectiles or chains,
    20% less damage) and Mercury (more Break, Freeze, Shock and Ignite). A Wafq that does not fit a Talisman does
    nothing, and each sits in one Talisman at a time;
  - Blank Talismans and Wafq drop; a Blank carves any Talisman at its level, or raises one you have; the Brass Stylus
    adds a slot. Any class can use any Talisman: the Warrior got cast clips, the Sorcerer staff swings and slams.
- **Elemental ailments** on monsters: Ignite (fire over time), Chill (slow), Freeze (a buildup to a full stop) and
  Shock (they take more damage), with frost, flicker and ember visuals.
- **Why?** (`game/menu_tabs.cpp`): the Character tab puts a cursor on every number; North shows every modifier behind
  it and where it came from (an item, a star, a Wafq, the class, the level, attributes). The main skill's DPS is shown
  as the GDD §8 pipeline, step by step.
- **The title screen** (`game/title.*`): the black sun over a skyline of domes and minarets, four character slots (the
  Slice 2 save becomes slot 1), a class choice for a new character, and delete on two presses.
- **The build simulator** (`tools/buildsim.cpp`, `qbuildsim`): for each class at levels 10, 20 and 30, the Recommended
  Path against 200 random builds on the same six sets of rare gear. It flags a Recommended Path more than 2 sd below
  the crowd, any build more than 4 sd above it, a random build 50% ahead on DPS and EHP at once, and a path that weakens
  as it levels, and writes `build/buildsim_report.md`.
- **CI** (`.github/workflows/qahira.yml`, Linux): Blender art under the `bpy` module (cached on the generators' hash),
  the tree and its validator, the pack, the shaders, the build, the unit tests, the build simulator and six bots.
- **Linux builds:** the dev host, core, tests and bots build and run on Linux (software GL under Xvfb for screenshots).
- **Saves:** the character file v3 (Talismans, bars, Wafq, Blanks, the plan, a currency count; v1 and v2 files still
  load) and save states v6 (ailments, glyphs, hero bolts).

**Verified**

| Check | Result |
|---|---|
| Unit tests (`qtests`) | pass, 22 cases (6 new: every Wafq is a magic square and orders 3-9 are too; Wafq change the numbers as stated; any class can use any skill; plans follow the tree and place one star per press; character file v3; QR finders, timing and format) |
| QR codes decode | the encoder's output for 10- to 210-character strings (versions 1, 4, 6, 8, 10) decodes in zbar |
| Tree validator | pass: 131 stars; keystones in 8/17 (Warrior) and 9/18 (Sorcerer) points; Recommended Paths reachable |
| Build simulator | 0 flags; e.g. the Sorcerer's Recommended Path at level 30: 193 DPS against a crowd of 162 +/- 28 |
| `sky` bot (the exit): a level-31 Sorcerer opens the sky with Select, plans 30 stars with the stick magnet (the D-pad along edges when the magnet misses), places them one Select at a time, pays for a refund at level 31, and round-trips the build code | pass: 30 stars in 3.3 s of game time (rule: under 2 minutes) |
| `sorcerer` bot: the Slice 2 zone run as a Sorcerer, casting only through the controller | pass: 161 s, level 4, 64 kills, 0 deaths, save state mid-boss |
| `title` bot: a new Sorcerer from the title by button presses, her file, a delete on two presses, a new Warrior | pass |
| `walk`, `fight` and `zone` bots (the Warrior) | pass |
| Shaders as GLSL ES 3.00 | pass |
| On-device feel review | pending (RP6) |

| | |
|---|---|
| ![The Book of Fixed Stars, with a Sorcerer's stars and her plan](img/slice3-sky.jpg) | ![The build code and its QR](img/slice3-code.jpg) |
| ![Talismans, their Wafq and a Blank](img/slice3-talismans.jpg) | ![The Wafq of Saturn, as its magic square](img/slice3-wafq.jpg) |
| ![Why? The hit, step by step](img/slice3-why.jpg) | ![The title screen](img/slice3-title.jpg) |
| ![Ember Bolts, three at a time](img/slice3-bolts.jpg) | ![A Frost Glyph under a chilled pack](img/slice3-glyph.jpg) |

**Known gaps (carried forward)**
- The tree has no Masteries or attribute-choice stars yet, and no saved loadouts; they widen with the sky in later
  slices.
- Each class has one body type.
- The Stars screen's constellations are drawn as their star lines only; al-Sufi's figure drawings are not generated
  yet.
- Monsters still chase in straight lines.

## Slice 4 · Act I, Cairo in Twilight

*A fresh character plays from the rooftop to the Mokattam cliffs.*

**Delivered**
- **Six regions** (`tools/art/env/kit.py`, `regions.py`) on one shared cell kit, so any region's cells join: Downtown
  (Wust el-Balad), the Metro under Tahrir, Khan el-Khalili, al-Muizz Street, the Mokattam cliffs and the Bab Zuweila
  gate. 78 tiles, each region with its own entrance, boss court and landmark (the old cinema, a stalled train, the
  coppersmith's workshop, a sabil-kuttab, a radio mast). A test walks from the entrance to every cell of twenty layouts
  per zone, and to every monster each zone spawns.
- **The campaign** (`game/acts.*`): seven zones in a table (area levels 2 to 12), each with its region, music,
  ambience, spawns, elite, boss and the way on. **Waypoints** at every entrance and on the rooftop stair; a boss's death
  opens its court's gate to the next zone and records that zone's waypoint.
- **The Bab Zuweila trial**, the First Trial of Ascendancy: the gatekeeper seals your amulet as the toll, and gives it
  back when you leave; the Ifrit of Bab Zuweila grants two ascendancy points.
- **Six bosses, as data** (`BossDef`): Umm al-Ghūla moved onto the table, joined by the Iron Microbus (a possessed
  microbus that charges down a telegraphed line and throws out cable jinn), the Si'lah of Sadat Station (blinks and
  bolt volleys), al-Nasnas al-Kabir (leaps and a slam ring), the Ifrit of Bab Zuweila (fire pools, a nova, volleys) and
  the Qutrub of the Quarries (a pack leader that leaps and howls).
- **New monsters:** Cable Jinn, Dish Sentinels (a possessed satellite dish whose beam telegraphs its line), Si'lah
  (leapers), Nasnas (half-men that hop) and Qutrub (grave wolves). Monsters now path round walls on the nav grid, and
  each family dies in its own sound.
- **A lighting pass:** the regions' lamps, neon and tube lights were blowing out to white in the bloom (emission is
  multiplied by 18 in the shader); their emission goes through one scale now.
- **Art and sound:** the five creatures, the dish, the microbus and Usta Hassan the coppersmith
  (`characters/jinn.py`); six new pieces of music, each in its own maqam and rhythm (baladi, saidi, wahda, ayyub,
  maqsum); the Metro's and the cliffs' ambience; five death voices.
- **Two ascendancies** (`game/asc.*`, the menu's Ascendancy tab): **Ironclad** for the Warrior (Endurance Charges on
  Break or warcry, no knockback, armour against elemental hits, slams that punish Broken enemies) and **Stormbinder**
  for the Sorcerer (spell crits always Shock, Binding Cold, Ailment Weaver, Storm Mantle, the Conductor). Thirteen
  nodes each, a node needs its parent, a refund costs a Rosewater Vial; Endurance Charges show on the HUD.
- **Crafting** (`game/inventory.cpp`, `game/crafting.*`):
  - five new currencies with PoE's rules: Khamsa, Bakhoor Ash, Broken Tea Glass, Drop of Attar and the Ifrit's Ember
    (corruption: unchanged, an implicit, a mod burnt brighter, or remade; sealed either way);
  - six **Spice Blends** that add a mod of their family;
  - four **Coffee-Cup Omens**, read from the purse to bend the next craft;
  - **the Coppersmith's Bench** in Khan el-Khalili: sixteen recipes (three with the bench, the rest from each zone's
    cache and boss), one exact bench mod per item for dinars, and a free way to take it off. Usta Hassan moves up to
    the roof once you have found him;
  - the purse scrolls, and currencies arrive over the act (each has a minimum area level).
- **Twenty uniques and Poster Scraps** (`game/uniques.*`): each unique is the prop of an invented golden-age film, with
  its poster, year, cast and tagline. Scraps drop from bosses, rares and the Downtown cinema's billboard; the fourth
  scrap of a poster gives you what it shows. Uniques also drop, rarely, on their own.
- **The Journal** (a menu tab): quests with their rewards, the **codex** (an entry the first time you meet each
  monster family and each mechanic), and the posters, drawn with the quarters you lack torn away.
- **XP** now grows with the area level and falls off once you outgrow an area.
- **The waypoint list** includes a trial once its gate has opened, so a trial can be retried after levelling elsewhere.
- **Saves:** the character file v4 (waypoints, quests, the toll, recipes, the codex, Omens, the ascendancy, scraps, and
  items with corruption, unique and bench flags; v1–v3 still load) and save states v7 (Endurance Charges, boss move
  timers, interactable targets).
- **Bots:** `act1` (the exit), plus `bestiary`, `tour4` and `tour5` for screenshots. The pilots sidestep beams and
  fire pools as well as telegraphs, give up on an enemy they cannot reach, and navigate the inventory round wide items.
  CI runs `act1` on every push and nightly.

**Verified**

| Check | Result |
|---|---|
| Unit tests (`qtests`) | pass, 32 cases (10 new: zones walkable from the entrance and every spawn reachable; Khamsa, Glass and the Omens; Blends add their family; the Ember corrupts and seals; the bench adds one exact mod; the twenty uniques and Attar; ascendancy parents; character file v4; a hand-written v3 file still loads) |
| `act1` bot (the exit): a fresh Warrior from the rooftop through Downtown, the Metro, the Khan (the bench), al-Muizz, the Bab Zuweila trial, the City of the Dead and the Mokattam cliffs; it wears what it finds, places its stars and takes its ascendancy nodes | pass: level 13, 2 deaths, 273 kills, 18 minutes of play, 13 recipes learned. Earlier runs found the walls this slice then fixed: the Ifrit's fire pools covered the ground round it (smaller, shorter pools now), the trial fell out of the waypoint list, and an unreachable enemy could hold a pilot against a wall |
| `act1` as a Sorcerer | pass: level 13, 0 deaths, 253 kills, 11 minutes of play |
| `zone` and `sorcerer` bots (now in Downtown), `walk`, `fight`, `sky`, `title` | pass |
| Build simulator, tree validator, shaders | pass (0 flags: the Warrior's Recommended Path now takes the Lion's Heart third, which lifts its level-10 EHP from 2 sd under the crowd to level with it) |
| On-device feel review | pending (RP6) |

| | |
|---|---|
| ![Wust el-Balad: the Iron Microbus and a dish sentinel](img/slice4-downtown.jpg) | ![The Si'lah of Sadat Station, in the Metro](img/slice4-metro.jpg) |
| ![Khan el-Khalili's lanterns](img/slice4-khan.jpg) | ![al-Nasnas al-Kabir on al-Muizz Street](img/slice4-muizz.jpg) |
| ![The Ifrit of Bab Zuweila, the First Trial](img/slice4-trial.jpg) | ![The Qutrub of the Quarries on the Mokattam cliffs](img/slice4-mokattam.jpg) |
| ![Usta Hassan's Bench](img/slice4-bench.jpg) | ![Ironclad, the Warrior's ascendancy](img/slice4-ascendancy.jpg) |
| ![The Journal's posters, one quarter still torn away](img/slice4-journal.jpg) | |

**Known gaps (carried forward)**
- One ascendancy per class so far (the GDD has three); later trials add their points in Acts III, V and VI.
- The bots spend passive and ascendancy points by calling the same functions the screens call, not by pressing
  through them (`tour4` presses through the Ascendancy tab and the bench).
- Recipes are learned where they are found; there is no recipe item to carry or trade.
- Posters are drawn by the UI; the GDD's painterly poster renders from 3D scenes are not generated yet.
- The Khan has no boss: a rare and its pack guard the way on to al-Muizz.
- Possessed objects are rigid meshes that sway; they do not deform.
