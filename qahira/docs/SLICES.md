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
