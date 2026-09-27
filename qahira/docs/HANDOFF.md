# Handoff: Slices 3–11

Written on 2026-09-27, when Slices 3–11 moved to another agent. It covers the state of the branch, what Slice 3
already has, what's left, and what's worth knowing before you change anything.

## Where things stand

- **Branch:** `qahira`, pushed to `origin/qahira`. Branch from its head, so you start with Slices 0–2 and the
  first two Slice 3 commits. If you start from `9a518b6` (the end of Slice 2), you'll lose the tree work.
- **Slices 0–2 are done and verified.** [SLICES.md](SLICES.md) records what each delivered and how it was checked.
  The design docs are in [`_bmad-output/planning-artifacts/qahira`](../../_bmad-output/planning-artifacts/qahira).
  The slice plan is `slices.md` there, and the GDD is `gdd.md`.
- **The head is green.** `tools/build_all.sh --no-art` passes:
  - the tree validator (131 stars);
  - shaders as GLSL ES 3.00;
  - the Mac and Android builds;
  - 16 unit tests;
  - the `walk`, `fight` and `zone` bots. The zone run takes 163 s of game time with 0 deaths.

## Slice 3 so far

The plan (slices.md): a ~150-node tree v1 with a layout tool and validator; a tree UI on the controller and touch;
the Sorcerer with four Talismans and six Wafq supports; DPS breakdowns ("Why?"); respec; and a build simulator in
CI. **Exit:** a 30-node planned path allocated on the sticks in under 2 minutes, and the build-sim report running
in CI.

**Done and pushed:**

1. `007b5bf`, **the tree's data.** `tools/tree/build_tree.py` lays out the Book of Fixed Stars and writes
   `assets/generated/tree/tree.json`, which the pack maps to `data/tree.json`. `build_all.sh` runs it before
   packing.
   - **Layout:** the Pole (Polaris), Draco coiled round it between the spokes, and six class starts. Only the
     Warrior and Sorcerer are open.
   - **The Ecliptic** runs from 260° to 50°.
   - **Constellations** are drawn from their real star patterns, with named stars as notables:
     - for the Warrior: Leo, Orion, Taurus, Canis Major;
     - for the Sorcerer: Scorpius, Cygnus, Lyra, Corona Borealis, Perseus;
     - on the Templar arc: Aquila, Auriga, Corvus.
   - **Two lunar-mansion keystones** sit on the rim.
   - **The validator** fails the build if:
     - a star can't be reached from a class start;
     - a keystone is too far (the nearest must be ≤ 25 points, all of them ≤ 60);
     - stars sit closer than 44 units, or an edge is longer than 190;
     - two edges cross;
     - a notable's power falls outside 22–48;
     - a constellation holds more than 40% of a generic stat.
   - **Outputs:** it writes `build/tree_report.md` and `build/tree_preview.png`. v1 has 131 stars. The Warrior
     reaches the keystones in 8 and 17 points, the Sorcerer in 9 and 18.
2. `ba470e9`, **the tree runtime.**
   - `src/game/tree.*` loads the tree. An `Allocation` holds a class and its stars, with PoE's rules:
     - take a star next to your start or a held star;
     - refund one only if everything stays connected;
     - `path_to` returns the cheapest route;
     - other classes' starts are not roads.
   - Held stars' mods join the hero's stats, with source `1000 + star id`.
   - **Keystones** are implemented in `World::resolve_skill`:
     - `KS_FOLLOWER` (al-Dabaran): 40% more damage to the last enemy that hit you, 20% less to all others;
     - `KS_OVERLOAD` (al-Simak): crits deal no extra damage, but a crit grants 40% more elemental damage for 6 s.
   - **Hirz (energy shield):** it takes hits first, recharges after 2 s, and shows as a ring on the life orb.
   - **Build codes** look like `Q1<class>-<base-32 stars>-<checksum>`.
   - **Passive points** are level − 1 minus the stars placed. The HUD nudges when some are unspent.
   - **Save formats:** the character file is v2 (it adds the class and stars, and v1 files still load). Save
     states are v5.
   - **Tests** are in `tests/test_tree.cpp`.

**Still to do in Slice 3:**

- **The tree screen.** Nothing is drawn yet. The GDD §5.6 design:
  - a magnetised stick cursor that snaps to the nearest star in the push direction;
  - D-pad walking along edges;
  - L1/R1 jumping between planned notables, and L2/R2 zooming through three levels;
  - South to preview a path and its cost, with changes staged (Start applies, East cancels);
  - North to search by keyword chips;
  - a planner whose ghost stars one press allocates on level-up;
  - touch drag and tap;
  - stat deltas on every preview;
  - build codes shown as text and a QR code.

  The HUD already points players to Select for the tree; nothing opens it yet.
- The Sorcerer: model and clips, a staff, four Talismans, and class choice at a title screen.
- Six Wafq supports and a way to slot them.
- The DPS "Why?" breakdown, respec, and the build simulator in CI.
- A bot for the exit criterion, and the Slice 3 entry in SLICES.md.

**Parked, not pushed:** the local branch `qahira-slice3-wip` (`ea01c66`) on the original machine. It has never
been compiled or tested. It holds two things:
- `hero_stats(hero, stars, out)` and `World::summarize(stars)`, so the tree screen can preview life, mana, Hirz,
  armour, resistances and DPS without touching the live hero;
- `src/ui/qr.*`, a QR encoder (byte mode, level M, versions 1–10, Reed–Solomon, mask choice by penalty). It still
  needs a decode check; macOS's CIDetector can read a rendered PNG.

The branch is only reachable if someone pushes it from that machine. Take it or leave it.

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
- **Open question, never answered:** should Talismans and Wafq (skill and support gems), Hirz (energy shield), and
  the currency names become plain PoE terms? For now the themed names stay, and every tooltip says what the thing
  does in PoE terms. Ask before building more on the names.
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
- **The boss** is leashed to her court (17 m before she engages, 26 m after). When the hero escapes or dies, she
  walks home and heals.
- **Navigation:** `Level::find_path` runs A* on a nav grid rasterised from the colliders. Only the bots use it;
  monsters still chase in straight lines.
- **Tests and the tree:** `qtests` reads the generated tree via `QAHIRA_SOURCE_DIR`, so run `tools/tree/build_tree.py`
  (or `build_all.sh`) first. The "data/tree.json missing" line in the test output is harmless: the save test runs
  without a pack.
- **New stats:** freeze, shock, chains and projectile speed exist in `Stat` and appear on tree stars, but nothing
  reads them yet. They're waiting for the Sorcerer's spells.
