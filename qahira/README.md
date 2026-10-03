# QAHIRA

An offline action RPG in the tradition of *Path of Exile* 1 and 2, built as a launch title for one handheld,
the **Retroid Pocket 6 (8 GB)**. It's set in modern-day Cairo and the Arab world under an eclipse that never
ends. The design docs are in [`_bmad-output/planning-artifacts/qahira`](../_bmad-output/planning-artifacts/qahira)
(brief, GDD, architecture, slice plan, look-dev).

The game ships as a **libretro core** plus a content file. Drop `Qahira.qpk` into your roms folder and launch it
through RetroArch. Every asset (meshes, animations, fonts, sound) is generated from scripts in this repo using free tools.

![Umm al-Ghula in the City of the Dead](docs/img/slice2-boss.jpg)

## Play it on your RP6

No PC needed. Every push to the `qahira` branch publishes the two files to the
[`qahira-latest` release](https://github.com/keldessouky/completed-projects/releases/tag/qahira-latest):
`qahira_libretro_android.so` (the RetroArch core) and `Qahira.qpk` (the game). **[docs/PLAY.md](docs/PLAY.md)**
takes you from the handheld's browser to the title screen: download, install the core, place the pack, set the
video driver, controls, saves, updates and troubleshooting. It also covers playing on a PC with `qhost`. The game
runs on the RP6, and after that first install it updates itself from the menu's Game tab. The formal device
checks are still to run ([checklist](docs/RP6.md#device-checklist-slice-0-exit)).

## Status

Work proceeds in vertical slices ([slice plan](../_bmad-output/planning-artifacts/qahira/slices.md)).

| Slice | State |
|---|---|
| 0 · First Light | **Done** (device checks pending). The Warrior on a generated Cairo street. Details: [slice log](docs/SLICES.md) |
| 1 · One Fight | **Done**. The Warrior against ghouls from the street into the Khan el-Khalili souq, with skills, Break, loot, a HUD and synthesised sound. See the [slice log](docs/SLICES.md). |
| 2 · One Zone | **Done**. From the rooftop ahwa down into a generated City of the Dead, through the boss Umm al-Ghūla, and home, with the inventory, five crafting currencies, a loot filter, the vendor, portals, the map and a character file. See the [slice log](docs/SLICES.md). |
| 3 · One Sky | **Done**. The Book of Fixed Stars on the sticks (magnet cursor, planner, search, respec, build codes with QR), the Sorcerer with four Talismans, six Wafq supports drawn as magic squares, elemental ailments, "Why?" on every number, a title screen, and the build simulator in CI. See the [slice log](docs/SLICES.md). |
| 4 · Act I, Cairo in Twilight | **Done**. Six regions and seven zones from Downtown to the Mokattam cliffs, with waypoints, six data-driven bosses and the Bab Zuweila trial; the Ironclad and Stormbinder ascendancies; the Coppersmith's Bench, new currencies, Spice Blends and Coffee-Cup Omens; twenty uniques from invented golden-age film posters; the Journal and codex. A bot plays the whole act. See the [slice log](docs/SLICES.md). |
| 5 · The First Chart | **Done**. The Map of al-Idrisi (south at the top), sixteen sites over four Climes, charts with their own mods, the Haboob, a 20-node Astrolabe, and a simulation and a bot that both reach the Fourth Clime. See the [slice log](docs/SLICES.md). |
| 6 · The Nile to Luxor | **Done**. The Ranger (bows, evasion, poison, marks and Frenzy) with her piece of the sky and two ascendancies to choose between, Marksman and Outrider; Act II up the Nile through six zones on five new regions to El Naddāha, the Ram of the Avenue and the Deep Tomb; and the Mārid Rifts in the endgame. Bots play Act II and a rift through to the Rift Lord. See the [slice log](docs/SLICES.md). |
| 7 · The Western Desert | **Done**. The Mercenary (swords, a crossbow on the back that skills swap into hand, bleeding, piercing bolts, naphtha grenades) with his piece of the sky and two ascendancies, Duelist and Demolitionist; Act III across the Western Desert through six zones on four new regions, to the Hyena of the Sand Sea, the Second Trial at Bab al-Futuh and the Sand-Wraith of Siwa, with resistances 30% lower after it; and the Excavations in the endgame, with Amm Ramadan to barter relics. Bots play Act III and an Excavation through. See the [slice log](docs/SLICES.md). |
| 8 · The Maghreb Coast | **Done**. The Shadow (daggers, a quarterstaff on the back, traps, Wither, Power Charges, crits that poison) with his piece of the sky and two ascendancies, Nightblade and Mystic; Act IV along the Maghreb coast through six zones on four new regions, Ghadames to the Sebkha of Sijoumi, past Sarab the Mirage and the Iron Door of the Souq to the Ghula of the Salt; and the Zar Nights in the endgame, a drum circle whose rhythm the dead keep going. Bots play Act IV and a Zar Night through. See the [slice log](docs/SLICES.md). |
| 9 · The Atlas and the Strait | **Done**. The Templar (maces and sceptres, fire converted from the blow, the Beacon aura, a signal brazier, burning ground, Block) with his piece of the sky and two ascendancies, Zealot and Warden; Act V through seven zones on four new regions, the tanneries of Fes to the sea walls of the Strait, past Bu Ghettat, Dukhan and the Third Trial at Bab al-Nasr to Aisha Qandisha; and in the endgame, charts to the Sixteenth Reach over sixteen more sites, and the King's Pearls that open the Marid King's throne. Bots play Act V, the Reaches and the King. See the [slice log](docs/SLICES.md). |
| 10 · Across the Red Sea | **Done**. The Wanderer (a seventh class at the Pole of the sky, with Fragments of six other ascendancies); Act VI through seven zones on three new regions, Old Jeddah to Iram of the Pillars and Apep at the heart of totality, with resistances 60% lower after it and the choice to seal the Veil or leave the door open; bases past Act V so the hero keeps growing; the Gate of Iram, a Fourth Trial whose toll you choose; Falak, the second pinnacle; and uber versions of both pinnacles. Bots play Act VI with the Gate, Falak and the uber King. See the [slice log](docs/SLICES.md). |
| 11 · Arabic, accessibility and polish | **Done** (device checks pending). The UI in Arabic, shaped and laid out right to left; a Settings tab with the language, the text size, colour-blind safe loot colours, the screen shake and L2 hold or toggle; Balanced and Battery performance modes as a core option; and Umm al-Ṣubyān, the third pinnacle. See the [slice log](docs/SLICES.md). |
| After the first run on the RP6 | **Done**. The owner's notes from playing it: the glow cut by 80%, an objective arrow, a life flask upgraded through seven tiers, life regeneration on late gear, and spells as GBA-style pixel art. Also: Radio Kafr El-Sheikh in place of the music (the game downloads the show's episodes itself) and Coast to Coast AM from its podcast feed, a Game tab that updates the game in place from the latest release, and Amm Sayed always stocking a weapon for your hand. Every nightly bot passes, and an [art review page](https://claude.ai/artifact/8TnNL1AGKDW65RC9LtfktC) marks every zone, boss, screen and effect for the next art pass. See the [slice log](docs/SLICES.md). |

## Docs

- [Engine](docs/ENGINE.md): layers, the frame, renderer, animation, UI, levels and navigation, zones and areas,
  belongings and the menu, the boss, saves
- [Assets](docs/ASSETS.md): the Blender generators, rig and IK, skinning, file formats
- [Playing on the RP6](docs/PLAY.md): the player's guide, from the release download to the controls
- [Running on the RP6](docs/RP6.md): install, launch, adb workflow, device checklist
- [Slice log](docs/SLICES.md): what each slice delivered and how it was verified
- [Handoff notes](docs/HANDOFF.md): where things stand, and what to know before changing anything (the art review
  loop included)

## Build

Everything, including art, pack, both cores and the tests:

```bash
tools/build_all.sh
```

That gives you `build/Qahira.qpk` and `build/qahira_libretro_android.so`. Individual steps are below.

Requirements (all free, from Homebrew): `cmake ninja sdl2 woff2 glslang`, the `android-ndk` cask, and Blender 5.x.
On Linux (and in CI): `apt install cmake ninja-build libsdl2-dev libgl-dev glslang-tools woff2`, and Blender as a
Python module (`pip install bpy==5.0.1` into a Python 3.11), then `BLENDER_PY=path/to/python tools/build_all.sh`.

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P tools/art/build.py -- --preview
python3 tools/pack.py                      # -> build/Qahira.qpk
cmake -S . -B build/mac -G Ninja && cmake --build build/mac
./build/mac/qhost build/Qahira.qpk         # dev host window
```

The first command generates the assets into `assets/generated/` and writes preview sheets to `build/preview/`.

Android (RP6) core:

```bash
cmake -S . -B build/android -G Ninja -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_TOOLCHAIN_FILE=/opt/homebrew/share/android-ndk/build/cmake/android.toolchain.cmake \
  -DANDROID_ABI=arm64-v8a -DANDROID_PLATFORM=android-29
cmake --build build/android                # -> qahira_libretro_android.so
```

## Tests

```bash
./build/mac/qtests                                                               # stats, items, zones, nav, saves, skills, tree
./build/mac/qbuildsim                                                            # Recommended Paths against random builds
./build/mac/qchartsim                                                            # tier progression on the Map of al-Idrisi
./build/mac/qhost build/Qahira.qpk --headless --bot fight                        # plays the Slice 1 fight
./build/mac/qhost build/Qahira.qpk --headless --bot zone                         # hub -> Downtown -> boss -> hub
./build/mac/qhost build/Qahira.qpk --headless --bot sorcerer                     # the same, as the Sorcerer
./build/mac/qhost build/Qahira.qpk --headless --bot sky                          # 30 stars planned on the sticks
./build/mac/qhost build/Qahira.qpk --headless --bot title                        # the title screen and its slots
./build/mac/qhost build/Qahira.qpk --headless --bot act1                         # a fresh Warrior plays Act I through
./build/mac/qhost build/Qahira.qpk --headless --bot charts                       # level 14: charts to the Fourth Clime
./build/mac/qhost build/Qahira.qpk --headless --bot act2                         # Act II through, as Act I leaves you
./build/mac/qhost build/Qahira.qpk --headless --bot rifts                        # a rift, its seal, the Rift Lord
./build/mac/qhost build/Qahira.qpk --headless --bot act3                         # Act III through, as Act II leaves you
./build/mac/qhost build/Qahira.qpk --headless --bot digs                         # an Excavation, and Amm Ramadan
./build/mac/qhost build/Qahira.qpk --headless --bot act4                         # Act IV through, as Act III leaves you
./build/mac/qhost build/Qahira.qpk --headless --bot zar                          # a Zar Night, held to the song's end
./build/mac/qhost build/Qahira.qpk --headless --bot act5                         # Act V through, as Act IV leaves you
./build/mac/qhost build/Qahira.qpk --headless --bot reaches                      # after Act V: the Fifth Clime to the Eighth Reach
./build/mac/qhost build/Qahira.qpk --headless --bot king                         # four King's Pearls, the throne, the Marid King
QAHIRA_CLASS=ranger ./build/mac/qhost build/Qahira.qpk --headless --bot zone     # any bot as another class
./build/mac/qhost build/Qahira.qpk --hidden --bot tour --shot-every 30           # screenshots of every screen
./build/mac/qhost build/Qahira.qpk --hidden --bot tour3 --shot-every 30          # ... and Slice 3's
./build/mac/qhost build/Qahira.qpk --hidden --bot tour4 --shot-every 30          # Slice 4's bench, ascendancy, Journal
./build/mac/qhost build/Qahira.qpk --hidden --bot tour5 --shot-every 60          # every Act I zone and its boss
./build/mac/qhost build/Qahira.qpk --hidden --bot bestiary --shot-every 50       # each Act I monster in turn
./build/mac/qhost build/Qahira.qpk --hidden --bot tour6 --shot-every 60          # the map, the Astrolabe, a Haboob
QAHIRA_CLASS=ranger ./build/mac/qhost build/Qahira.qpk --hidden --bot tour7 --shot-every 50   # the Ranger in Act II, a rift
QAHIRA_CLASS=mercenary ./build/mac/qhost build/Qahira.qpk --hidden --bot tour8 --shot-every 50   # Act III, an Excavation
QAHIRA_CLASS=shadow ./build/mac/qhost build/Qahira.qpk --hidden --bot tour9 --shot-every 30      # Act IV, a Zar Night
QAHIRA_CLASS=templar ./build/mac/qhost build/Qahira.qpk --hidden --bot tour10 --shot-every 30    # Act V, the Reaches, the King
./build/mac/qhost build/Qahira.qpk --headless --bot act6                         # Act VI, the Gate of Iram, the Veil sealed
./build/mac/qhost build/Qahira.qpk --headless --bot falak                        # four Scales of Falak, Falak beneath the World
./build/mac/qhost build/Qahira.qpk --headless --bot subyan                       # four Combs, Umm al-Subyan
./build/mac/qhost build/Qahira.qpk --hidden --frames 90 --shot build/shot.png    # render check
tools/review/capture.sh && python3 tools/review/build.py                        # the art review's pictures and page
python3 tools/check_shaders.py                                                   # all shaders as GLSL ES 3.00
```

## Dev host controls

- **Move:** WASD
- **Skills:** J (south), U (west), I (north), L (R1), O (R2); hold Q (L2) for the second bar. The Warrior starts with
  Crushing Blow, Earthshatter, Rallying Shout and Aftershock; the Sorcerer with Ember Bolt, Arc, Frost Glyph and
  Falling Star; the Ranger with Split Arrow, Falcon's Mark, Rain of Arrows and Scorpion's Kiss
- **Dodge:** K (east)
- **Use / talk / travel:** J (south), when no enemy is close
- **Life flask:** 1 (L3 / M1)
- **Radio:** 2 (R3 / M2): tap for the next station, hold for the next episode
- **Pick up:** ← (D-pad left), or J when it's calm
- **Portal:** ↑ (D-pad up, in a zone)
- **Map:** ↓ (D-pad down, in a zone)
- **Loot filter preset:** → (D-pad right)
- **Menu (inventory, Talismans, character, loot filter):** Enter = Start. Inside it, L1/R1 (E/L) switch tabs, J equips
  or uses, I drops (and shows "Why?" on the Character tab), and K backs out.
- **The Book of Fixed Stars:** hold Tab (Select). Tap Tab in the field to place the next planned star.
- **Shoulders:** E = L1, L = R1, Q = L2, O = R2; Tab = Select
- **Save states:** F5 save, F9 load
- **Screenshot:** F12

Gamepads work through SDL.

## Layout

| Path | What it holds |
|---|---|
| `src/core` | Math, the pack reader, JSON, logging |
| `src/gfx` | GL layer, tiled forward renderer (HDR, bloom, tonemap), meshes, shaders |
| `src/anim` | Skeletons and sampled clips |
| `src/ui` | SDF text and HUD drawing |
| `src/game` | Game code |
| `src/platform` | libretro entry point and input |
| `host/` | `qhost`, the SDL2 libretro dev frontend |
| `tools/art` | Blender generators: shared rig with IK, model exporter, characters, props |
| `tools/pack.py` | Builds the content pack |
| `tools/check_shaders.py` | Validates shaders with glslang |
| `tools/tree/build_tree.py` | Lays out and validates the passive tree |
| `tools/buildsim.cpp` | The build simulator (`qbuildsim`) |
| `tools/fx` | The spell effects' pixel-art sheet, drawn in Python |
| `tools/review` | The art review: the gallery bot's pictures, made into a review page |
| `src/audio` | The mixer, and the radio (Radio Kafr El-Sheikh, Coast to Coast AM, and the episode downloads) |
| `src/net` | HTTP and HTTPS for the radio and the in-game updates |
| `third_party` | libretro.h (MIT), stb_truetype / stb_image_write / stb_vorbis (public domain), minimp3 (CC0), Mbed TLS (Apache-2.0) |

Fonts are Inter and Noto Sans Arabic (SIL OFL), converted from the copies that ship with Blender.
