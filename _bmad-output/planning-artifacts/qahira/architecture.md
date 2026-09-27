---
title: "QAHIRA — Technical Architecture"
status: draft v2
created: 2026-09-27
updated: 2026-09-27
companions: [brief.md, gdd.md, slices.md]
---

# QAHIRA — Technical Architecture

**Target:** Retroid Pocket 6, 8 GB. Snapdragon 8 Gen 2 (1× Cortex-X3 at
3.2 GHz, 4× A715/A710, 3× A510), Adreno 740, LPDDR5X, 5.5" 1920×1080 AMOLED at
120 Hz, Android 13, active cooling, 6000 mAh.

**Delivery:** `Qahira.qpk` in the roms folder, run by a **libretro core**
(`qahira_libretro_android.so`) inside RetroArch.

---

## 1. Engine decision: a custom C++ engine, "Mashrabiya", as a libretro core

A drop-in file in the roms folder, launched through an emulator, means **the
game has to be a libretro core.** A core is a native arm64 library that
RetroArch loads directly. There is **no emulation overhead**: our code runs
natively and draws straight to the GPU through libretro's hardware-render
interface. This is how the Dolphin, PPSSPP and Flycast cores render in 3D.

No off-the-shelf engine (Godot, Unity, Unreal) can build as a libretro core, so
we write our own, purpose-built for one device. This is also the right choice
for a launch title: console launch games tend to be built on engines tuned to
exactly one piece of hardware.

**What libretro gives us, so we don't build it:** the window and GL context,
vsync and presentation, input (the RetroPad, analog, pointer/touch, rumble,
sensors), audio output, the save directory, **save states** (our `serialize`
function), core options menus, pausing on sleep, and launcher integration.

**What we build:** a renderer, animation, simulation, gameplay systems, UI,
audio mixing and synthesis playback, the content pack format, and tools.

| Choice | Decision | Why |
|---|---|---|
| Language | **C++20**, with few dependencies and no exceptions or RTTI in the hot path | NDK clang, predictable performance, same code on Mac, Linux CI and Android |
| Graphics API | **OpenGL ES 3.2** on the device (`RETRO_HW_CONTEXT_OPENGLES_VERSION` 3.2); **GL 4.1 core** on the Mac dev host | GLES 3.2 on Adreno 740 comfortably covers our budget (instancing, UBOs, MRT, float render targets, texture arrays). It works on the Mac without MoltenVK and is the best-tested hardware path in libretro on Android. A small shader-header shim covers `#version 320 es` vs `410 core`. Vulkan would reduce CPU driver overhead, but with ≤ 400 instanced draw calls we don't need it; it stays a documented option if profiling ever says otherwise. **No compute shaders**, so the Mac path matches. |
| Build | CMake + Ninja; the Android NDK toolchain for `arm64-v8a` | Standard and free |
| Deps (all permissive, vendored) | `libretro.h` (MIT), stb_image / stb_vorbis (PD), cgltf (MIT), HarfBuzz (MIT), zstd (BSD), doctest (MIT), AMD FSR 1 shaders (MIT), SDL2 (zlib, **dev host only**) | No paid or closed components |

---

## 2. Budgets (Balanced: 60 fps = 16.6 ms)

| Budget | Target |
|---|---|
| Sim (movement, collision, damage, AI) | ≤ 3 ms on the X3 core |
| Gameplay, UI, stat engine | ≤ 2 ms |
| Render submission (CPU) | ≤ 3 ms |
| GPU: 1440×810 3D + native 1080p UI | ≤ 11 ms |
| Draw calls | ≤ 400 (instancing everywhere) |
| Visible triangles | ≤ 700 k |
| Dynamic lights on screen | ≤ 64 (clustered) + 1 shadowed key light |
| Live enemies / projectiles / particles | 150 / 400 / 4,000 |
| Process memory (core + RetroArch) | ≤ 2 GB |
| Textures resident | ≤ 800 MB (ASTC) |
| Zone generate + load | ≤ 2 s |
| Battery at Balanced | ≥ 3 h (whole-device average ≤ 7.5 W), **measured every slice** |
| Thermal | ≥ 58 fps after a 30-min soak |

---

## 3. Renderer

Forward+ on a tile-based GPU. Adreno does well with fewer, fatter passes and
cheap MSAA resolves.

**Frame graph (fixed, hand-ordered):**
1. **Shadow pass:** one 2048² map for the key light (the dusk sky, or the
   corona glow in night zones). Its frustum is fitted to the fixed camera, so
   one cascade is enough.
2. **Depth pre-pass** for opaque geometry, which also feeds light clustering.
3. **Light clustering on the CPU:** a 16×9×24 froxel grid. Light indices go
   into a UBO or texture-buffer list. 64 lights cost roughly nothing on the CPU.
4. **Opaque forward pass** into **RGBA16F**, with 4× MSAA at 0.75 scale
   (cheap on tile memory). The shading model is stylised: PBR-lite, baked AO
   and lightmaps per tile, **mashrabiya light cookies** on spot lights, rim
   light, and height fog.
5. **Transparent and particle pass:** instanced, stateless particles, whose
   position is computed from time and seed in the vertex shader (so no compute
   shaders are needed). Also decals: telegraphs, cracks, blood, sand.
6. **Post:** a 13-tap dual-filter **bloom** (the neon needs it), exposure, a
   **per-region colour-grading LUT**, filmic tonemap, **FSR 1 EASU + RCAS**
   upscale to 1080p, and film grain.
7. **UI pass at native 1080p:** MSDF text (Latin + shaped Arabic), 9-slice
   geometric frames, and a vector pattern shader for arabesque borders.

**Characters and hordes:**
- **GPU skinning for everyone.** Animation clips are pre-baked into
  **bone-matrix textures** (frames × bones). The vertex shader samples and
  blends two clips. Per-instance data is a clip id, time, blend weight and tint.
  One draw call per enemy type per LOD, with no per-enemy CPU animation cost.
- The player and bosses use the same path, plus CPU-side IK for foot
  placement where it shows.

**Asset formats (cooked by tools, loaded with zero parsing):**
- Meshes: interleaved and quantised. Positions are 16-bit snorm with a scale;
  normals are octahedral; UVs are half-float.
- Textures: **ASTC** (4×4 for UI and hero, 6×6/8×8 for environments), encoded
  by ARM's `astcenc` (Apache-2.0). Desktop packs use BC/uncompressed, because
  the Mac GL 4.1 path has no ASTC support.

---

## 4. Simulation

- **Fixed 60 Hz sim** with an accumulator driven by libretro's **frame-time
  callback**, and render interpolation. At 120 fps the sim runs every other
  frame and the renderer interpolates. At 40 fps it runs 1–2 steps per frame.
- **Deterministic:** seeded RNG streams per system. Bot runs replay exactly, and
  `serialize` (save states) writes sim arrays plus RNG state.
- **Data-oriented:** entities are struct-of-arrays in fixed-capacity pools, with
  **zero allocation per frame**.
- **Combat is 2D on the XZ plane:** a spatial hash with 4 m cells; swept-circle
  projectiles; circle, cone and line area queries; walls from the tile's
  **walkable grid** (0.5 m cells).
- **Horde navigation:** a flow field over a 64×64 window around the player,
  plus separation. Bosses and elites use A* on the walkable grid.
- **Threads:** the sim and clustering can each take a worker (the A715 cores).
  Rendering stays on the libretro video thread, which is where the GL context
  lives.
- **Events:** the sim writes hits, deaths and drops into an event ring buffer.
  VFX, audio, rumble and UI consume it. The sim never calls presentation code.

---

## 5. Stat and modifier engine

This is the heart of a PoE-style game. It's pure C++ with no rendering
dependencies, and it has the most tests.

- Stat ids are compiled from `data/stats.json`.
- Modifiers are `{stat, kind, value, tags, conditions, source}`.
- Queries take a **tag context** and are cached per (stat, context hash). The
  cache is invalidated on source changes.
- **The damage pipeline** follows GDD §8 and returns a breakdown record for
  every stage. That record drives the "Why?" view and ±DPS/EHP.
- **Text is generated from structured mods; it is never parsed.**
- **Golden tests:** build JSON → expected DPS, EHP and breakdown lines.

---

## 6. Data, content pack and tools

```
qahira/
├─ engine/          C++: platform (libretro), gfx, render, anim, audio, text, pack, ui
├─ game/            C++: sim, stats, items, skills, tree, world, ai, save
├─ host/            qhost: SDL2 dev frontend (windowed) + headless test runner
├─ data/            JSON, the source of truth (stats, mods, bases, uniques, talismans,
│                   wafq, classes, tree constellations, monsters, regions, charts,
│                   filter presets, localisation en/ar)
├─ art/             generator sources (Blender Python scripts, pattern specs, palettes)
├─ audio/           synth patches, maqam scores, SFX recipes
├─ tools/           TypeScript/Node: pack builder, data + tree validators, tree layout,
│                   build simulator, audio synth, font/MSDF baker, deploy
├─ tests/           doctest suites, golden builds, bot scenarios
└─ dist/            Qahira.qpk · qahira_libretro_android.so · Qahira.lpl · README-RP6.md
```

**The `.qpk` "ROM":** a single file with a header, a table of contents, and
zstd-compressed chunks (cooked meshes, textures, anim textures, audio, data,
fonts). It is memory-mapped where possible and versioned against the core,
which refuses a mismatched pack with a readable message.

**Tools pipeline:**
```
art/*.py ──Blender (headless)──► .glb ─┐
pattern specs ──► PNG/SDF ─────────────┤
audio/*.score ──synth──► .ogg ─────────┼──► tools/pack ──► Qahira.qpk
data/*.json ──validate/tree-layout─────┤      (cook: quantise, ASTC, bake anim
fonts (OFL) ──MSDF bake──► atlases ────┘       textures, compress, TOC)
```

- **Stable ids** for tree nodes, mods and items, so saves and build codes
  survive data changes.
- **Validators in CI:** schema and references, tree health (GDD §5.7), and the
  **build simulator** (DPS/EHP for every Recommended Path and random builds,
  flagging outliers beyond 2σ per level band).

---

## 7. Level generation

- **Tiles** are generated by Blender scripts per region (Cairo street blocks,
  souq alleys, necropolis courtyards, the metro, desert, medina, Shibam towers),
  each with typed **connectors**. AO and lightmaps are baked in Blender
  **Cycles** at generation time.
- A **grammar** per zone type, for example `start → 3–6 rooms → landmark →
  2–4 rooms → boss arena`, with side branches. Tiles are placed with AABB
  rejection.
- **Population** by Poisson-disk sampling on the walkable grid, within a
  per-zone density budget.
- **Dressing:** neon signs, fawanees, laundry lines, satellite dishes and cats
  are scattered from per-region tables. Most are light emitters, which feed the
  clustered lighting.

---

## 8. Saves and suspend

- **In-game saves:** `profile`, `char_<id>`, `stash`, `atlas` in RetroArch's
  **save directory** (`RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY`). Versioned with
  migrations. Atomic writes (temp, fsync, rename) and 3 rolling backups.
- **Save states** (`retro_serialize`): the full world, meaning sim arrays, zone
  seed and tile placement, RNG, ground items, and UI mode. RetroArch's
  auto-save-state and resume-on-launch give suspend-anywhere.
- Autosave on every zone transition.

---

## 9. Art pipeline: generated in-house with free, open tools only

| Tool | Licence | Use |
|---|---|---|
| **Blender** (headless, `bpy` scripts) | GPL (outputs are ours) | Architecture and prop generators, character modelling from scripted base meshes, rigging, keyframed animation, Cycles bakes (AO, lightmaps, poster renders) |
| **Our pattern generator** (TS) | ours | Girih and zellige star patterns, mashrabiya lattices, khayamiya panels, arabesque borders, as SVG, SDF and tiling textures |
| **astcenc** | Apache-2.0 | Texture compression |
| **HarfBuzz + msdfgen / msdf-atlas-gen** | MIT | Arabic shaping and MSDF font atlases |
| **Fonts:** Amiri, Noto Naskh/Kufi Arabic, Reem Kufi, Aref Ruqaa, Lalezar, Cairo, Inter | SIL OFL | UI text, signage, titles |
| **Our synth** (TS, like `gen-audio.mjs` from Ziggurat Run) | ours | Oud, qanun, ney, percussion, SFX; maqam quarter-tone tuning |

**Not used:** paid tools, AI image or audio generators, asset-store packs,
downloads of unknown origin. Every asset is **regenerable from a script in the
repo**.

**Why this works for this setting:**
- Islamic geometric art is literally algorithmic. The patterns are exactly
  reconstructable from compass-and-straightedge rules, which is a very good fit
  for code.
- Cairo's architecture breaks down into kits: apartment blocks with balconies
  and AC units, Mamluk domes (parametric carved-dome generator), minarets
  (stacked sections), mashrabiya screens (pattern → mesh), mudbrick Shibam
  towers, Maghreb medina walls.
- **Characters:** a scripted base humanoid (parametric body with male and female
  morphs) on **one shared skeleton**. Clothing is built as layered shell meshes
  (galabeya, jacket, keffiyeh, armour). A stylised, slightly painterly look,
  in the spirit of hand-painted posters, forgives what photorealism wouldn't.
  Creatures are kitbashed from procedural parts on variant rigs.
- **Animation:** keyframed in Blender by script (gait generators, attack
  poses with curves tuned for weight). This is the highest-effort art
  area, so it is pulled forward into Slice 1 to find its quality level early.

---

## 10. Input (libretro)

- **RetroPad** via `input_state`, plus `RETRO_DEVICE_INDEX_ANALOG_BUTTON` for
  **analog L2/R2** and `RETRO_DEVICE_POINTER` for **touch**.
- **Rumble:** `RETRO_ENVIRONMENT_GET_RUMBLE_INTERFACE`. Strong and weak motors,
  with patterns per event.
- **Gyro:** `RETRO_ENVIRONMENT_GET_SENSOR_INTERFACE`
  (`RETRO_SENSOR_GYROSCOPE_ENABLE`). **Slice 0 verifies** whether RetroArch on
  Android delivers it on the RP6. If not, gyro aim becomes a "desktop/when
  available" feature and nothing depends on it.
- Rear M1/M2 alias L3/R3 through Retroid's system mapping (GDD §2).
  `README-RP6.md` documents the setup.
- **Core options (v2):** performance mode, render scale, fps cap, rumble
  strength, gyro on/off, UI text size, language.

---

## 11. Frame pacing on a 120 Hz panel

- The core reports 60 fps in `retro_get_system_av_info`. It changes that with
  `RETRO_ENVIRONMENT_SET_SYSTEM_AV_INFO` when the performance mode changes (40,
  60 or 120).
- We ship a **per-core RetroArch override** (`config/Qahira/Qahira.cfg`) with
  the right vsync swap interval, threaded video off, and the preferred video
  driver (`gl`). Slice 0 measures actual pacing (frame-time histogram) on the
  RP6 for each mode.
- Frame times come from the frame-time callback, so the sim never assumes a
  rate.

---

## 12. Testing and CI

| Layer | How | When |
|---|---|---|
| Unit + golden (stats, damage pipeline, crafting, filter, tree pathing, save migrations) | doctest | Every push |
| Data, tree and build-sim validators | Node tools | Every push |
| **Bot playthroughs:** `qhost --headless` loads the core with a **null renderer** and drives a bot through the slice's content (fight, loot, craft, save, **serialize → unserialize → continue**) | GitHub Actions, Linux | Every push |
| **Golden screenshots:** `qhost` renders fixed scenes offscreen and compares against references within a tolerance | macOS runner or local | Nightly / before a slice demo |
| **On-device perf:** an in-core perf logger (frame time, CPU sim/render, GPU timer queries) writes a CSV to the save dir. `tools/deploy` samples temperature and battery alongside it over adb (`dumpsys thermalservice`, `dumpsys battery`). | RP6 | Every slice exit |

---

## 13. Build and deploy

- **Mac dev host:** `cmake --preset mac && ninja && ./qhost` runs the game in a
  window with a gamepad, live data reload, and a hot-reloaded pack.
  RetroArch for macOS (free) is also used to test the real libretro path.
- **Android:** `cmake --preset android-arm64 && ninja` builds
  `qahira_libretro_android.so`, then `tools/pack --target android` builds
  `Qahira.qpk` with ASTC textures.
- **`tools/deploy`:** adb push of the `.qpk` to `ROMs/Qahira/` and the `.so` to
  a staging folder. The first install needs RetroArch's "Install or Restore a
  Core" once. RetroArch is then launched on the content through an intent, and
  the perf CSV is pulled afterwards.
- **Dev machine setup** (all free Homebrew packages): `android-ndk`,
  `android-platform-tools` (adb), `blender`, `retroarch`, `ninja`, `sdl2`. **None
  of these are installed yet.** Slice 0 starts by installing them.

---

## 14. Slice 0 device checks (the first thing to prove)

1. A custom core installs into RetroArch on the RP6, and **Daijisho / RetroArch
   playlist / the Retroid launcher** can launch `Qahira.qpk` with it.
2. `RETRO_HW_CONTEXT_OPENGLES_VERSION` 3.2 context is granted. Record the GPU
   string and the extensions (ASTC, float render targets, MSAA).
3. **Pacing** at 40, 60 and 120 on the 120 Hz panel.
4. Every RetroPad input reaches the core, plus analog L2/R2 range, pointer
   (touch), **rumble**, and **gyro**.
5. Save states round-trip mid-fight. Auto-save-state on close works.
6. Stress numbers: 150 skinned enemies, 400 projectiles, 64 lights, full post,
   and a 30-minute thermal soak with battery drain logged.

The results go into this document as §15, and they set the budgets for every
slice after.
