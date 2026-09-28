---
title: "QAHIRA — Vertical Slice Plan"
status: draft v2
created: 2026-09-27
updated: 2026-09-27
companions: [brief.md, gdd.md, architecture.md]
---

# QAHIRA — Vertical Slice Plan

**Rule:** every slice cuts through every layer (art generator → pack → engine →
gameplay → UI → audio → save → test → **on the RP6 from the roms folder**). A
slice adds only what it needs. It is thin everywhere and complete end to end.

## Definition of done (every slice)
1. `Qahira.qpk` + core run on the RP6 from `ROMs/Qahira/` through the launcher,
   **within budget at Balanced**. The perf CSV is attached to the slice notes.
2. The bot scenario for the slice passes headless in CI. Unit and golden tests
   pass.
3. In-game save and **RetroArch save state** both round-trip within the slice's
   content.
4. Every asset in the slice comes from a generator in the repo, built by the
   pipeline, not placed by hand.
5. You play it and review feel and cultural authenticity. Notes are recorded.

---

## Slice 0: First Light
*A street in Cairo at dusk, on the RP6.*

- Dev environment: NDK, adb, Blender, RetroArch, SDL2, all through Homebrew.
- Engine skeleton: the libretro core, `qhost` (windowed + headless), pack
  format v1, GLES 3.2 / GL 4.1 shim.
- **One generated Downtown street tile:** apartment blocks with balconies, AC
  units and satellite dishes, **two neon Arabic shop signs** (shaped with
  HarfBuzz), fawanees, one mashrabiya window casting a patterned light cookie,
  and the black sun in the sky.
- Renderer v0: clustered forward lighting (64 lights), HDR, bloom, LUT, FSR 1,
  and one shadow.
- **One generated character** on the shared rig, walking and idling, skinned on
  the GPU, driven by the left stick with a follow camera.
- One synthesised sound (an oud pluck on footstep cadence) and a 20-second
  ambient drone.
- A save file write and read, and `serialize` / `unserialize`.
- A perf HUD and CSV logger. The **device checks from architecture.md §14**.
- **Stress mode** (a core option): 150 skinned instances, 400 projectile
  sprites, 64 lights.
- Bot: walk from spawn to the sign. Assert the position. Save state, restore,
  assert again.

**Exit:** it runs from the roms folder on the RP6. The device checks are
recorded, and the stress-mode numbers set the real budgets.

## Slice 1: One Fight
*The Warrior against a ghoul pack in a Khan el-Khalili alley.*

- The Warrior (one body type) with a two-handed maul and **4 Talismans** (GDD §6):
  wind-up, impact, recovery, cancels, dodge, hit-stop, rumble.
- Ghoul family: swarmer, bruiser, spitter, plus one **rare** with 2 mod icons.
- **Stat engine v1** with golden tests. One item drop with real affixes.
  Equipping it changes damage, and the tooltip shows ±DPS.
- A Life flask on L3/M1. Death and respawn.
- HUD v1 (orbs, skill bar with RetroPad glyphs).
- Music: a Hijaz loop on synthesised oud and darbuka. Hit and death SFX. Ghoul
  crumble VFX.

**Exit:** the fight feels good on the RP6 (your call), and the bot clears the
pack in CI.

## Slice 2: One Zone
*From the rooftop hub to the City of the Dead and back.*

- The rooftop ahwa hub, with one vendor and the cat.
- A zone generator with one tileset (the City of the Dead necropolis courtyards)
  and a grammar with a landmark and a boss arena.
- Boss: **Umm al-Ghūla** (2 phases, a Break window).
- XP and levels 1–8. Inventory v1 (12×5). **Loot filter** presets. 5 currencies.
  Portal. Overlay map.
- Character save and load. A save state in the middle of the boss.

**Exit:** a fresh character goes hub → zone → boss → hub, and the bot does the
same.

## Slice 3: One Sky
*The Book of Fixed Stars, first draft, with a second class.*

- Tree v1: about 150 nodes (the Pole, the Warrior and Sorcerer regions, a piece
  of the Ecliptic, and 2 lunar-mansion keystones). Layout tool and validator.
- **Tree UI on the controller and touch:** magnetism, edge-walking, path
  preview, staged apply, planner, search, QR build codes.
- The Sorcerer (4 Talismans) and **6 Wafq** supports. Breakdowns on the DPS
  sheet ("Why?"). Respec.
- The build simulator in CI.

**Exit:** you allocate a 30-node planned path on the sticks in under 2 minutes,
and the build-sim report runs in CI.

## Slice 4: Act I, Cairo in Twilight
- 6 zones (Downtown, the Metro, Khan el-Khalili, al-Muizz, the City of the
  Dead, Mokattam). Umm al-Ghūla and the **Bab Zuweila trial**, with the
  sealed-slot toll.
- 2 ascendancies (Ironclad, Stormbinder).
- The Coppersmith's Bench, Spice Blends, Coffee-Cup Omens, 20 uniques, Poster
  Scraps. The codex.

**Exit:** a fresh player finishes Act I. The bot plays through the whole act
nightly.

## Slice 5: The First Chart
*The endgame loop is proven early, on Act I's tilesets.*

- The Map of al-Idrisi v1, chart tiers 1–4, one mechanic (**Haboob**), and an
  Astrolabe tree of 20 nodes.

**Exit:** a level-14 character can loop charts, and tier progression works in
the bot simulation.

## Slices 6 onward: widening
Each later slice has the same shape: **one act + one class + two ascendancies +
its tree region + one endgame piece.**

| Slice | Act | Class added | Endgame piece |
|---|---|---|---|
| 6 | II · The Nile to Luxor | Ranger | Mārid Rifts |
| 7 | III · The Western Desert (Trial II) | Mercenary | Excavations |
| 8 | IV · The Maghreb Coast | Shadow | Zar Nights |
| 9 | V · The Atlas & the Strait (Trial III) | Templar | Charts to T16, the Mārid King |
| 10 | VI · Across the Red Sea, Apep | Wanderer | Gate of Iram trial, Falak, ubers |
| 11 | Arabic RTL UI, accessibility, polish | — | Umm al-Ṣubyān |

The full ~850-node tree is complete by Slice 10. Each slice widens the sky
around the class it adds.
