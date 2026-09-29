# Handoff: Slices 3–11

Written on 2026-09-27, when Slices 3–11 moved to another agent. It covers the state of the branch, what Slice 3
already has, what's left, and what's worth knowing before you change anything.

## Where things stand

- **Branch:** `qahira`, pushed to `origin/qahira`.
- **Slices 0–3 are done and verified.** [SLICES.md](SLICES.md) records what each delivered and how it was checked.
  Slice 3 was finished after the handoff: the Stars screen, the Sorcerer, Talismans and Wafq, ailments, "Why?", the
  title screen, the build simulator and CI. The parked `qahira-slice3-wip` branch was never pushed; its two pieces
  (a stats preview and a QR encoder) were written again (`summarize` in `game/world.cpp`, `ui/qr.*`).
- **Slice 11 is done, and with it Slices 3–11:** Arabic text (shaped, right to left, the layout mirrored), the
  Settings tab (language, text size, colour-blind loot colours, screen shake, L2 hold or toggle), the Balanced and
  Battery performance modes as a core option, and Umm al-Ṣubyān, the third pinnacle. What is left is the device
  checklist in [RP6.md](RP6.md) and the known gaps in the slice log.
- **Slice 10 (Across the Red Sea) is done:** the Wanderer (the Pole start, Fragments), Act VI's seven zones to
  Apep, the 60% resistance penalty and the Veil-or-door ending, bases past Act V, the Gate of Iram (the Fourth Trial,
  a toll you choose), Falak and the uber pinnacles. `act6` (with the Gate) and `falak` run in CI. Every push also
  publishes the RP6 core and pack on the `qahira-latest` prerelease (see [PLAY.md](PLAY.md)). Next is Slice 11.
- **Slice 9 (the Atlas and the Strait) is done:** the Templar with the Beacon, the signal brazier, burning ground and
  Block, his sky and the keystone al-Iklil, the Zealot and the Warden, Act V's seven zones on four regions to Aisha
  Qandisha with Trial III at Bab al-Nasr, charts to the Sixteenth Reach over sixteen more sites, and the King's Pearls
  that open the Marid King's throne. The `act5` and `king` bots run in CI; `reaches` nightly. The weak spot is hero
  scaling past Act V (see its Known gaps); Slice 10 added the higher-level bases.
- **Slice 8 (the Maghreb Coast) is done:** the Shadow with traps, Wither and Power Charges, his sky and the keystone
  al-Sharatan, the Nightblade and the Mystic, Act IV's six zones on four regions with Sarab the Mirage, the Iron Door
  of the Souq and the Ghula of the Salt, and the Zar Nights. The `act4` and `zar` bots run in CI.
- **Slice 7 (the Western Desert) is done:** the Mercenary with the weapon swap, bleeding, piercing and grenades, his
  sky and the Duelist and Demolitionist, Act III's six zones on four regions with the Hyena of the Sand Sea, Trial II
  at Bab al-Futuh and the Sand-Wraith of Siwa, the resistance penalty after it, and the Excavations with Amm Ramadan.
  The `act3` and `digs` bots run in CI.
- **Slice 6 (the Nile to Luxor) is done:** the Ranger and her sky, Marksman and Outrider (the first class with a
  choice of two), Act II's six zones on five regions with El Naddaha, the Ram of the Avenue and the Deep Tomb, and the
  Marid Rifts. The `act2` and `rifts` bots run in CI.
- **Slice 5 (the First Chart) is done:** the Map of al-Idrisi, charts of four Climes, the Haboob, the Astrolabe,
  `qchartsim` and the `charts` bot (nightly in CI).
- **Slice 4 (Act I) is done too:** six regions, seven zones, the Bab Zuweila trial, two ascendancies, the bench,
  Blends, Omens, twenty uniques with Poster Scraps, and the Journal. See its SLICES.md entry for what is left over.
- **The head is green on Linux and in CI** (`.github/workflows/qahira.yml`): the tree validator, shaders, 87 unit
  tests, the build and chart simulators, and the `walk`, `fight`, `zone` (and as the Ranger, the Mercenary, the
  Shadow and the Templar), `sorcerer`, `sky`, `title`, `rifts`, `digs`, `zar`, `king`, `act1`, `act2`, `act3`, `act4`
  and `act5` bots. Nightly adds `charts`, `reaches`, `act2` as the Ranger, `act1` and `act3` as the Mercenary, `act3`
  and `act4` as the Shadow, and `act5` as the Templar.
- **Linux:** everything builds and runs there. Blender runs as the `bpy` module (`pip install bpy==5.0.1` into a
  Python 3.11); `tools/pack.py` finds Blender's fonts in the Mac app or the module. Screenshots need a GL context:
  run `qhost --hidden` under Xvfb.
- **Naming (answered):** the owner keeps the themed names (Talisman, Wafq, Hirz, the street currencies), and every
  tooltip says the PoE term or job alongside.

## How the project works

- **Vertical slices.** Every slice cuts through every layer: generator → pack → engine → gameplay → UI → save →
  tests. It ends playable, and it ends with a SLICES.md entry that says what was verified and how.
- **Everything is generated.** Meshes, animation, tiles and props come from Blender scripts in `tools/art`; the
  tree comes from `tools/tree`; every sound comes from `tools/audio/synth.py`. `assets/generated/` is a build output
  and is not committed. Tools must be free and safe. Nothing is downloaded.
- **The build and checks:**
  - `tools/build_all.sh` runs everything; `--no-art` skips Blender.
  - The bots run headless: `./build/mac/qhost build/Qahira.qpk --headless --bot zone`.
  - For screenshots of every screen, run `--hidden --bot tour --shot-every 30`.
  - Set `QAHIRA_BOT_TRACE=1` for a bot's running commentary.
  - Bots press buttons and drive the menus through `Input`, like a player. Keep it that way; it's what caught the
    aiming bug in Slice 2.
- **Commits:**
  - Commits are logical, and each one builds and passes its tests. Slice 2's intermediate commits were each built
    in a throwaway worktree to prove it.
  - Commit messages end with the co-author line.
  - Push after each batch; a local-only branch counts as a flaw.
  - Stage QAHIRA's own paths only. The repository holds other projects, and `crawler/` has the owner's uncommitted
    changes.
- **Save formats are versioned.** Bump `kStateVersion` (`src/game/app.cpp`) when the simulation's saved data
  changes. Bump `kCharVersion` (`src/game/save.cpp`) when the character file changes, and keep reading the older
  versions.

## Design direction from the owner

- **Classes and mechanics are PoE's:** "it should be like path of exile and path of exile 2. its just the
  environment and look that is different." The owner found culturally themed classes pandering, so the classes are
  plain archetypes (GDD §4).
- **The world and the look are Cairo, North Africa and the Arab world.** Star names, lunar mansions, street-object
  currencies and the ahwa are part of that look.
- **Names:** the themed names stay (asked and answered); every tooltip says what the thing does in PoE terms.
- **Cultural rules** are in `brief.md` §5:
  - no Qur'anic text or divine names;
  - mosques are never combat spaces;
  - monsters come from folklore;
  - no real conflicts.
- **The target is the Retroid Pocket 6.** On-device checks are still pending ([RP6.md](RP6.md)). RetroArch for
  macOS can't host the core; use `qhost`.

## Things worth knowing

- **Enum names:** don't name enum values `M_E` and the like; `<math.h>` defines `M_E`. The zone masks are `DIR_N`,
  `DIR_E`, `DIR_S` and `DIR_W` for that reason.
- **macOS sed:** BSD `sed` has no `\b`. Use Python for word-boundary renames.
- **Blender generators:**
  - The voxel remesh drops open surfaces, so cap lofts (the keeper's robe vanished until it was capped).
  - A one-section `sloft` with caps makes a duplicate face.
- **UI:**
  - The font atlas only bakes the codepoints listed in `src/ui/ui.cpp`. `◀` wasn't one of them; the D-pad glyphs
    use the arrows `←` `↑` `→` `↓`.
  - `Ui::frame` with a transparent fill still paints the border as a filled rectangle. Draw outlines with four
    rects, as the menu does.
  - `Ui::text` returns the text's width, not its end x.
- **Aiming:** skills aim where the stick points, not where the body faces. Before that fix, a dodge left the hero
  swinging at air.
- **Bosses** are rows in `boss_def` (world.cpp) and are leashed to their court. When the hero escapes or dies, they
  walk home and heal. A rigid boss (a possessed object with no skeleton) resolves its moves on fixed timings.
- **Navigation:** `Level::find_path` runs A* on a nav grid rasterised from the colliders. Monsters and the bots both
  use it.
- **Tables that characters store by index** (append only): item bases, affixes (the generic `g_*` ones come after the
  rolled ones), skills, monsters, zones, quests' bits, recipes, codex entries, uniques, ascendancy nodes and
  ascendancies (characters store the one chosen), currencies, sites, Astrolabe nodes, and the tree's star ids.
- **A new zone** is a `ZoneDef` row plus a region in `tools/art/env/regions.py` or `regions2.py` to `regions5.py` (or an existing tileset). Run
  `qtests`: it walks every zone and checks every spawn can be reached.
- **Chart balance:** the drop rules are in `game/atlas.cpp`; change them, then run `qchartsim`, which reads the same
  functions. A site's roads are its `links`; a dead end strands players (the simulation found one at Ayla).
- **Any bot as any class:** `QAHIRA_CLASS=shadow` (or templar, mercenary, ranger, sorcerer, warrior). `QAHIRA_ACT_AT=karnak`
  (or `shali`, or `medina`) starts the `act2` (or `act3`, `act4`) bot at one zone with what comes before it done.
  `QAHIRA_BOSS_TRACE=1` prints a line every half second of any boss fight in the act bots; a death names its killer.
  `QAHIRA_TOUR_ZAR=1` starts `tour9` at its Zar Night (as `QAHIRA_TOUR_DIG=1` does `tour8` at its Excavation).
- **Bot pilots:** the melee pilot trades a boss's cone above 60% life; the Shadow never does, and kites bosses
  through `caster_combat` with traps and Black Sand. Kiting bends round a boss's court (`Bot::keep_to_court`), since a
  boss led past its leash walks home and heals. In a chart, a pilot too hurt to trade with the site's master and with
  its flask dry backs off until life comes back. Menus are steered by a search over the menu's own moves.
- **Masks that outgrew their bits:** waypoints are `ZoneBits` (128 zones; there are 66), and the keystone and
  ascendancy rules (`Hero::keystones`) are 64 bits: the Shadow's take 32-36, the Templar's 37-40, and new ones
  continue from 41. Tree keystones use bits 0-5. The site masks (`sites_revealed`, `sites_done`) are 32 bits and the
  map has 32 sites: another site needs 64-bit masks and a character file bump. The tag mask (`T_*`) is full at 32.
- **Chart tiers:** `kChartTiers` is 16, `kChartTiersEarly` (4) the cap before Act V (`ChartRun::max_tier`). The
  Reaches' climb (`kReachUp`, `kReachDown`) and the pearl rates (`pearl_drops`) are the knobs; `qchartsim` checks both
  the early map and the road to the throne. `QAHIRA_TOUR_KING=1` starts `tour10` at the map of the Reaches;
  `QAHIRA_TOUR_GATE=1` starts `tour11` (the Wanderer, Act VI, the Gate, Falak) at the Gate of Iram.
- **The weapon swap:** `EQ_WEAPON2` is the weapon on the back; it adds no stats until `World::swap_weapons` brings it
  into hand, which `start_skill` does when a skill needs its kind. Rate a skill with `hero_skill_ctx`, which uses the
  weapon it would really be used with.
- **Landmark and arena set pieces** go where the cell's way in is not: a landmark opens to the north, so its pieces
  stand in the south half; an arena opens to the south. Leave no slot between a piece and the court's wall that a
  pilot can squeeze into (the Ram's court had one). `qtests` walks every zone and finds unreachable courts.
- **Balance knobs:** XP per area level (`World::kill`), monster rows (`monster_defs`), boss move damage (`BossDef`), and
  the `act1` bot's death count and final level, which CI prints.
- **Tests and the tree:** `qtests` reads the generated tree via `QAHIRA_SOURCE_DIR`, so run `tools/tree/build_tree.py`
  (or `build_all.sh`) first. The "data/tree.json missing" line in the test output is harmless: the save test runs
  without a pack.
- **Append-only tables:** items store their base's and affixes' indices, and Talismans their skill's index. Add new
  bases, affixes and skills at the end of their tables, never in the middle.
