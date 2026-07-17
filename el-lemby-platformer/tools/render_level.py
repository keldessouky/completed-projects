#!/usr/bin/env python3
"""
Renders every level .txt into PNGs using the same pixel art the game uses,
so stage layouts can be reviewed without a Mac or a PC:

    docs/level1.png, docs/level2.png, …   full stages at 1×
    docs/screenshot.png                    stage 1 opening screen at 2×

Run from the project root:  python3 tools/render_level.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generate_assets as art  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEVELS_DIR = os.path.join(ROOT, "Sources", "ElLembyCore", "Resources", "levels")
DOCS = os.path.join(ROOT, "docs")

SKY = (166, 204, 216, 255)
T = 16

TILE_SPRITES = {
    "G": "tile_ground",
    "D": "tile_dirt",
    "B": "tile_brick",
    "X": "tile_crate",
    "=": "tile_stone",
    "?": "tile_mystery",
    "F": "tile_mystery",
}

ENTITY_SPRITES = {
    "P": "lemby_idle_0",
    "E": "thug_walk_0",
    "N": "nousa_0",
    "C": "checkpoint_idle",
}


def load_rows(path):
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if line.startswith("//"):
                continue
            rows.append(line)
    while rows and not rows[0].strip():
        rows.pop(0)
    while rows and not rows[-1].strip():
        rows.pop()
    cols = max(len(r) for r in rows)
    return [r.ljust(cols, ".") for r in rows], cols


def render(level_name, sprites):
    rows, cols = load_rows(os.path.join(LEVELS_DIR, level_name + ".txt"))
    width, height = cols * T, len(rows) * T
    img = art.blank(width, height, SKY)

    far = sprites["bg_far"]
    near = sprites["bg_near"]
    far_top = height - 44 - len(far)
    near_top = height - 2 * T - len(near)
    for x in range(0, width, art.BG_W):
        art.blit(img, far, x, far_top)
    for x in range(0, width, art.BG_W):
        art.blit(img, near, x, near_top)

    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            name = TILE_SPRITES.get(ch)
            if name:
                art.blit(img, sprites[name], c * T, r * T)
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch == "o":
                art.blit(img, sprites["coin_0"], c * T + 2, r * T + 2)
            elif ch in ENTITY_SPRITES:
                sp = sprites[ENTITY_SPRITES[ch]]
                art.blit(img, sp, c * T, (r + 1) * T - len(sp))

    art.write_png(os.path.join(DOCS, level_name + ".png"), img)
    print(f"wrote docs/{level_name}.png ({width}×{height})")

    # review filmstrip: the stage cut into stacked screens (not committed)
    strips = []
    per = 820
    for x0 in range(0, width, per):
        strips.append([row[x0:x0 + per] for row in img])
    gap = 8
    sheet = art.blank(per, len(strips) * (height + gap), (40, 40, 48, 255))
    for i, s in enumerate(strips):
        art.blit(sheet, s, 0, i * (height + gap))
    out_dir = os.environ.get("LEMBY_FILMSTRIP_DIR", "/tmp")
    out = os.path.join(out_dir, f"{level_name}_filmstrip.png")
    art.write_png(out, sheet)
    print(f"wrote {out} (review filmstrip)")
    return img


def main():
    os.makedirs(DOCS, exist_ok=True)
    sprites = art.build_all()
    levels = sorted(
        f[:-4] for f in os.listdir(LEVELS_DIR) if f.endswith(".txt")
    )
    first_img = None
    for name in levels:
        img = render(name, sprites)
        if first_img is None:
            first_img = img

    # 2× crop of stage 1's opening screen for the README
    if first_img is not None:
        crop = [row[:480] for row in first_img[:272]]
        art.write_png(os.path.join(DOCS, "screenshot.png"), art.scale(crop, 2))
        print("wrote docs/screenshot.png (960×544)")


if __name__ == "__main__":
    main()
