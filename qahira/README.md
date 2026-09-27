# QAHIRA

An offline action RPG in the tradition of *Path of Exile* 1 and 2, built as a launch title for one handheld,
the **Retroid Pocket 6 (8 GB)**. It's set in modern-day Cairo and the Arab world under an eclipse that never
ends. The design docs are in [`_bmad-output/planning-artifacts/qahira`](../_bmad-output/planning-artifacts/qahira)
(brief, GDD, architecture, slice plan, look-dev).

The game ships as a **libretro core** plus a content file. Drop `Qahira.qpk` into your roms folder and launch it
through RetroArch. Every asset (meshes, animations, fonts, sound) is generated from scripts in this repo using free tools.

## Status

Work proceeds in vertical slices ([slice plan](../_bmad-output/planning-artifacts/qahira/slices.md)).

| Slice | State |
|---|---|
| 0 · First Light | **Done** (device checks pending). The Warrior on a generated Cairo street. Details: [slice log](docs/SLICES.md) |
| 1 · One Fight | **Done**. The Warrior against ghouls from the street into the Khan el-Khalili souq, with skills, Break, loot, a HUD and synthesised sound. See the [slice log](docs/SLICES.md). |
| 2–11 | Not started |

## Docs

- [Engine](docs/ENGINE.md): layers, the frame, renderer, animation, UI, levels, save states
- [Assets](docs/ASSETS.md): the Blender generators, rig and IK, skinning, file formats
- [Running on the RP6](docs/RP6.md): install, launch, adb workflow, device checklist
- [Slice log](docs/SLICES.md): what each slice delivered and how it was verified

## Build

Everything, including art, pack, both cores and the tests:

```bash
tools/build_all.sh
```

That gives you `build/Qahira.qpk` and `build/qahira_libretro_android.so`. Individual steps are below.

Requirements (all free, from Homebrew): `cmake ninja sdl2 woff2 glslang`, the `android-ndk` cask, and Blender 5.x.

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
./build/mac/qtests                                                               # stat engine golden tests
./build/mac/qhost build/Qahira.qpk --headless --bot fight                        # plays the whole fight
./build/mac/qhost build/Qahira.qpk --hidden --frames 90 --shot build/shot.png    # render check
python3 tools/check_shaders.py                                                   # all shaders as GLSL ES 3.00
```

## Dev host controls

- **Move:** WASD
- **Skills:** J (south) Crushing Blow, U (west) Earthshatter, I (north) Rallying Shout, L (R1) Aftershock
- **Dodge:** K (east)
- **Life flask:** 1 (L3 / M1)
- **Pick up or equip:** ← (D-pad left)
- **Shoulders:** E = L1, L = R1, Q = L2, O = R2
- **Menu:** Enter = Start, Tab = Select
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
| `third_party` | libretro.h (MIT) and stb_truetype / stb_image_write (public domain) |

Fonts are Inter and Noto Sans Arabic (SIL OFL), converted from the copies that ship with Blender.
