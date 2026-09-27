# Engine

A purpose-built C++20 engine, "Mashrabiya", shipped as a **libretro core**. It targets one device: the Retroid
Pocket 6, with its Adreno 740 and a 1080p 120 Hz AMOLED, running GLES 3.2 through RetroArch for Android. The same
code builds for macOS (GL 4.1 core) for development.

## Layers

```
platform/libretro_core.cpp   retro_* entry points: HW context, RetroPad -> Input, fixed-step loop, save states
platform/app_api.hpp         the only interface between libretro and the game (app_init, app_update, app_render, ...)
game/                        the game (the app_* functions live in game/app.cpp)
ui/                          SDF text + shapes in a 1920x1080 logical space
gfx/                         GL wrappers, renderer, meshes, shaders
anim/                        skeletons, sampled clips, poses
core/                        math, pack reader, JSON, byte streams, logging
host/qhost.cpp               SDL2 libretro frontend for the Mac (window or headless); links the core directly
```

The game never calls libretro or SDL. `qhost` implements the same frontend contract as RetroArch:
- `SET_HW_RENDER` hands the core a GL context and framebuffer.
- Input arrives through `input_state`.
- The core's audio output is queued to SDL.

So what runs in qhost is what runs on the device, except for the GL flavour.

## Frame

`retro_run` does four things, in order:
1. It polls the RetroPad. The analog triggers and pointer (touch) come from their dedicated libretro indices.
   Face buttons are named by position (south, east, west, north), because the RP6 can swap its labels.
2. It calls `app_update(input, 1/60)`. This is one fixed simulation step, so the simulation is deterministic, bot
   runs replay exactly, and save states are just the sim state.
3. It calls `app_render(fbo, 1920, 1080)`, rendering into the framebuffer the frontend provides.
4. It hands 800 stereo samples (48 kHz / 60) to the frontend.

## Renderer (`gfx/renderer.*`)

It's a forward renderer that bins lights into screen tiles, because the city at night is lit by dozens of small
lights (neon, lanterns, lamps).

1. **Tiling (CPU):** each point light's bounding box is projected to the screen and binned into a 16×9 tile grid.
   The per-tile light lists go into an `R8UI` texture (a count plus 31 indices per tile). Up to 64 lights per frame
   go in a UBO.
2. **Scene pass:** draws into an `RGBA16F` target at 0.75× scale (1440×810) with depth.
   - Meshes are batched by type and drawn with `glDrawElementsInstanced`.
   - Per-instance data holds the model matrix, a tint, the skinning-palette offset, a hit flash, a dissolve amount
     and a rim light.
3. **Skinning:** on the GPU. Bone matrices (3×4) for every animated instance are packed into one `RGBA32F` texture
   each frame, and each instance carries its palette offset. That's one draw call per mesh type however many
   monsters share it.
4. **Shading:**
   - GGX specular with Lambert diffuse.
   - Hemisphere ambient, weighted by the baked per-vertex AO.
   - A low violet "sun" (dusk light) plus the tile's point lights.
   - Rim light: amber for the player, magenta for enemies.
   - Emissive materials, and distance fog.
5. **World sprites:** soft discs, rings, sectors and glows (for decals, telegraphs, particles), in an alpha pass
   and an additive pass.
6. **Bloom:** a 13-tap downsample chain (six levels) with a soft threshold, then a tent-filter upsample.
7. **Composite:** into the frontend's framebuffer at 1920×1080. Scene plus bloom, then exposure, the ACES filmic
   curve, lift/gain/saturation grading, vignette, sRGB conversion, and dithering.
8. **UI:** drawn on top at native resolution (see below).

Every shader is written in the common subset of GLSL ES 3.00 and GLSL 3.30. `tools/check_shaders.py` compiles all
of them as ES 3.00 with Khronos' `glslangValidator`, which is how the RP6 path is checked without the device.

## Animation (`anim/`, `game/animator.hpp`)

- Skeletons share one humanoid layout of 22 bones (`tools/art/qart/rig.py`). Every bone's bind frame is
  axis-aligned with the character (Z up, facing −Y), so clip data is plain local rotations, and any skeleton with
  the same bone names can play the same clips.
- Clips are sampled at 30 fps, with linear/nlerp blending between frames and named events (e.g. `hit` at the
  impact frame).
- `Animator` crossfades between clips and fires each event once per play.

## UI (`ui/`)

- Text uses signed-distance-field glyphs rendered by stb_truetype at startup (Inter, OFL). The same atlas draws any
  size crisply; bold is a threshold shift, and outlines come from the distance field.
- Shapes are analytic in the fragment shader: rounded rectangles and rings (for the orbs).
- Clipping uses scissor markers inside the vertex stream, so everything draws in submission order.

## Levels (`game/level.*`)

A level is a set of placed tiles. Each tile has two parts, both generated in Blender:
- a static mesh, and
- a JSON sidecar listing its colliders (axis-aligned boxes) and light sources.

Characters collide as circles against the boxes, pushed out along the shortest axis. Lights within 28 m of the
player are submitted each frame, with a slight neon flicker.

## Save states

`retro_serialize` writes a versioned byte stream (`core/serial.hpp`) of the simulation state: position, velocity,
facing, the current clip and its time, the fired-event mask, sim time, and the camera. RetroArch's save states and
auto-resume therefore work anywhere, including mid-fight. The `walk` bot checks this by saving, moving the
player, restoring, and comparing.

## Known platform notes

- **RetroArch for macOS (the 1.22 Homebrew build)** can't host this core. Its only GL driver is the legacy `gl`
  driver, which fails with "Invalid enum" while creating its own framebuffer for any core-profile GL core, before
  the core draws anything. The device path, RetroArch for Android with GLES 3.2, uses a different context, and it's
  the same path the GLES cores PPSSPP and Flycast use. On the Mac, use `qhost`.
- The core asks for no depth or stencil in the frontend framebuffer. It renders into its own targets and only
  composites into the frontend's.
