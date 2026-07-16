#!/usr/bin/env python3
"""
Renders a level .txt into PNGs using the same pixel art the game uses, so
stage layouts can be reviewed without a Mac:

    docs/level1.png       full stage at 1× (one long strip)
    docs/screenshot.png   the opening screen at 2× (README hero shot)

Run from the project root:  python3 tools/render_level.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generate_assets as art  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEVEL = os.path.join(ROOT, "Sources", "ElLembyCore", "Resources", "levels", "level1.txt")
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


def main():
    rows, cols = load_rows(LEVEL)
    sprites = art.build_all()
    width, height = cols * T, len(rows) * T
    img = art.blank(width, height, SKY)

    # parallax strips drawn flat for the preview
    far = sprites["bg_far"]
    near = sprites["bg_near"]
    far_top = height - 44 - len(far)
    near_top = height - 2 * T - len(near)
    for x in range(0, width, art.BG_W):
        art.blit(img, far, x, far_top)
    for x in range(0, width, art.BG_W):
        art.blit(img, near, x, near_top)

    # tiles, then entities standing on cell bottoms
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

    os.makedirs(DOCS, exist_ok=True)
    art.write_png(os.path.join(DOCS, "level1.png"), img)
    print(f"wrote docs/level1.png ({width}×{height})")

    # 2× crop of the opening screen
    crop_w = 480
    crop = [row[:crop_w] for row in img[:272]]
    art.write_png(os.path.join(DOCS, "screenshot.png"), art.scale(crop, 2))
    print("wrote docs/screenshot.png (960×544)")

    # review filmstrip: the stage cut into stacked screens (not committed)
    strips = []
    per = 820
    for x0 in range(0, width, per):
        strips.append([row[x0:x0 + per] for row in img])
    gap = 8
    sheet_h = len(strips) * (height + gap)
    sheet = art.blank(per, sheet_h, (40, 40, 48, 255))
    for i, s in enumerate(strips):
        art.blit(sheet, s, 0, i * (height + gap))
    out = os.environ.get("LEMBY_FILMSTRIP", "/tmp/level1_filmstrip.png")
    art.write_png(out, sheet)
    print(f"wrote {out} (review filmstrip)")


if __name__ == "__main__":
    main()
