# Drop-in art packs

The game ships with its own procedural pixel art, so it runs with this folder
empty. To use sprites from an art pack instead, put the image files here next to
a `manifest.json` and reload — no rebuild required.

**Nothing in this folder is committed.** Several popular packs allow use but
forbid redistribution, so keeping your copies local avoids that entirely.

## manifest.json

Map an atlas frame name to a whole image:

```json
{
  "king0": "king-iron.png",
  "e_runner": "runner.png"
}
```

…or to a rectangle inside a sheet:

```json
{
  "e_runner": { "src": "chars.png", "x": 0, "y": 0, "w": 32, "h": 32 },
  "e_brute":  { "src": "chars.png", "x": 32, "y": 0, "w": 32, "h": 32 }
}
```

Anything that fails to load is skipped and keeps the built-in sprite, so a
partial pack is fine — override only the frames you care about.

## Quick start

1. Copy `manifest.example.json` to `manifest.json`.
2. Drop your PNGs in this folder with the filenames it references.
3. Reload the page. No rebuild.

Frame size is derived from the image — `width / frames` — so you never have to
measure a sheet. Anything that fails to load is skipped and keeps the built-in
sprite, so a partial pack is fine.

## Animated sheets

Units are animated on a 4-frame walk cycle, so their frames are numbered. To map
an 8-frame strip onto them, describe the strip and the loader slices it:

```json
{
  "king0": {
    "src": "adventurer-walk.png",
    "frameW": 96, "frameH": 96,
    "frames": 8,
    "row": 0,
    "count": 4
  }
}
```

- `frameW` / `frameH` — **optional.** Omit them for a single-row strip and they
  are derived from the image (`width / frames` by full height)
- `frames` — how many frames the strip actually has
- `row` — which row of the sheet (0 for a single-row strip)
- `count` — how many game frames to fill (4 for units); if the strip has more
  frames than that they wrap, so a 8-frame walk maps cleanly onto the 4 the game
  asks for

## Frame names

| Group | Names |
| --- | --- |
| King walk, per era | `king0_0` … `king4_3` — or map a strip as `king0` |
| King attack, per era | `king0_atk0`, `king0_atk1` — or a strip as `king0_atk` |
| Soldier walk, era × tier | `sol0_0_0` … `sol4_2_3` — or a strip as `sol0_0` |
| Soldier attack | `sol0_0_atk0`, `sol0_0_atk1` — or a strip as `sol0_0_atk` |
| Enemies | `e_runner`, `e_brute`, `e_shooter`, `e_flyer`, `e_flyer1`, `e_boss` |
| Hit flashes | same name + `W` (e.g. `e_bruteW`) |
| Towers / keeps / walls, per era | `tower0`…`tower4`, `keep0`…`keep4`, `wall0`…`wall4` |
| Other buildings | `barracks`, `forge`, `rubble` |
| Projectiles, per era | `p0` … `p4`, plus `pEnemy` |
| Pickups | `coin`, `shard` |

Sprites are anchored at the feet (0.5, 0.8), so tall art hangs upward from its
ground position. One art pixel is 2 world units in the built-in art; packs keep
their own pixel size unless you crop them to match.

## A note on 3D packs

KayKit-style packs are low-poly **3D models**, not 2D sprites — they can't be
dropped straight into a 2D renderer. To use them you would pre-render each
character to a sprite sheet (a turntable or a single 3/4 angle) and reference the
resulting PNG here.
