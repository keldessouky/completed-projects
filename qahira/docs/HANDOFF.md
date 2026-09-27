# Handoff: Slices 3–11

Written on 2026-09-27, when Slices 3–11 moved to another agent. It covers the state of the branch, what Slice 3
already has, what's left, and what's worth knowing before you change anything.

## Where things stand

- **Branch:** `qahira`, pushed to `origin/qahira`.
- **Slices 0–3 are done and verified.** [SLICES.md](SLICES.md) records what each delivered and how it was checked.
  Slice 3 was finished after the handoff: the Stars screen, the Sorcerer, Talismans and Wafq, ailments, "Why?", the
  title screen, the build simulator and CI. The parked `qahira-slice3-wip` branch was never pushed; its two pieces
  (a stats preview and a QR encoder) were written again (`summarize` in `game/world.cpp`, `ui/qr.*`).
- **Slice 4 (Act I) is done too:** six regions, seven zones, the Bab Zuweila trial, two ascendancies, the bench,
  Blends, Omens, twenty uniques with Poster Scraps, and the Journal. See its SLICES.md entry for what is left over.
- **The head is green on Linux and in CI** (`.github/workflows/qahira.yml`): the tree validator, shaders, 32 unit
  tests, the build simulator, and the `walk`, `fight`, `zone`, `sorcerer`, `sky`, `title` and `act1` bots. `act1`
  also runs nightly.
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
  rolled ones), skills, monsters, zones, quests' bits, recipes, codex entries, uniques, ascendancy nodes, currencies.
- **A new zone** is a `ZoneDef` row plus a region in `tools/art/env/regions.py` (or an existing tileset). Run
  `qtests`: it walks every zone and checks every spawn can be reached.
- **Balance knobs:** XP per area level (`World::kill`), monster rows (`monster_defs`), boss move damage (`BossDef`), and
  the `act1` bot's death count and final level, which CI prints.
- **Tests and the tree:** `qtests` reads the generated tree via `QAHIRA_SOURCE_DIR`, so run `tools/tree/build_tree.py`
  (or `build_all.sh`) first. The "data/tree.json missing" line in the test output is harmless: the save test runs
  without a pack.
- **Append-only tables:** items store their base's and affixes' indices, and Talismans their skill's index. Add new
  bases, affixes and skills at the end of their tables, never in the middle.
