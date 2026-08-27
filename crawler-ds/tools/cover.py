#!/usr/bin/env python3
"""The box art, drawn out of the game's own pixels.

A front end that lists ROMs shows two things: whatever the ROM's banner
carries, and a cover image beside the filename if it can find one. The banner
is thirty-two pixels square and lives inside the ROM (tools/forge.py builds
it); this is the other one.

Nothing here is imported from outside the repo. The crawlers are the same
sprites the battle screen draws, the lettering is the same 5x7 font the game
prints with, the stone is the same tiling texture the dungeon floor is made
of, and every colour is a step of tools/art/palettes.py -- so the cover is
made of the game rather than being a picture about it. Scaled with nearest
neighbour and nothing else: a smoothed pixel is a lie about what is inside.

    python3 tools/cover.py dist/cover.png
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, 'art'))

import font5x7                                                  # noqa: E402
import png                                                      # noqa: E402
from palettes import INK, RAMPS, UI                             # noqa: E402

W, H = 512, 640


def _sprites():
    """Pull the finished sprites straight out of the generated table, so the
    cover cannot drift from what the ROM actually contains."""
    src = open(os.path.join(ROOT, 'src', 'gen', 'art.c')).read()
    out = {}
    for name in ('carl', 'donut', 'tex_floor_a', 'tex_wall_a'):
        pix = re.search(r'static const uint8_t pix_%s\[\d+\] = \{(.*?)\n\};' % name, src, re.S)
        pal = re.search(r'static const uint16_t pal_%s\[\d+\] = \{(.*?)\n\};' % name, src, re.S)
        dim = re.search(r'const Sprite spr_%s = \{ (\d+), (\d+)' % name, src)
        colours = []
        for v in (int(x, 16) for x in re.findall(r'0x([0-9A-Fa-f]+)', pal.group(1))):
            colours.append((((v) & 31) * 255 // 31,
                            ((v >> 5) & 31) * 255 // 31,
                            ((v >> 10) & 31) * 255 // 31))
        out[name] = (int(dim.group(1)), int(dim.group(2)),
                     [int(x) for x in re.findall(r'\d+', pix.group(1))], colours)
    return out


class Sheet:
    def __init__(self, w, h, fill):
        self.w, self.h = w, h
        self.px = bytearray(bytes(fill) * (w * h))

    def put(self, x, y, rgb):
        if 0 <= x < self.w and 0 <= y < self.h:
            o = (y * self.w + x) * 3
            self.px[o:o + 3] = bytes(rgb)

    def rect(self, x, y, w, h, rgb):
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.put(i, j, rgb)

    def vgradient(self, x, y, w, h, top, bot):
        for j in range(h):
            t = j / float(max(1, h - 1))
            c = tuple(int(round(top[k] + (bot[k] - top[k]) * t)) for k in range(3))
            self.rect(x, y + j, w, 1, c)

    def blit(self, sprite, ox, oy, zoom, skip0=True):
        w, h, pix, pal = sprite
        for y in range(h):
            for x in range(w):
                i = pix[y * w + x]
                if skip0 and not i:
                    continue
                rgb = pal[i]
                for dy in range(zoom):
                    for dx in range(zoom):
                        self.put(ox + x * zoom + dx, oy + y * zoom + dy, rgb)

    def tile(self, sprite, x, y, w, h, zoom):
        tw, th, pix, pal = sprite
        for j in range(h):
            for i in range(w):
                s = pix[((j // zoom) % th) * tw + ((i // zoom) % tw)]
                self.put(x + i, y + j, pal[s])

    def text(self, glyphs, s, x, y, zoom, rgb, spacing=1):
        """The game's own 5x7 font, blown up. A cover set in a real typeface
        would be a promise the game cannot keep."""
        cx = x
        for ch in s:
            code = ord(ch)
            rows = glyphs[code] if code < len(glyphs) else glyphs[32]
            for gy in range(7):
                bits = rows[gy]
                for gx in range(5):
                    if bits & (1 << (4 - gx)):
                        for dy in range(zoom):
                            for dx in range(zoom):
                                self.put(cx + gx * zoom + dx, y + gy * zoom + dy, rgb)
            cx += (5 + spacing) * zoom
        return cx - x - spacing * zoom

    def text_width(self, s, zoom, spacing=1):
        return len(s) * (5 + spacing) * zoom - spacing * zoom


def build(path):
    glyphs = font5x7.parse()
    art = _sprites()

    sky_top = RAMPS['arcane'][0]
    sky_bot = INK['ink']
    s = Sheet(W, H, sky_top)

    #  Sky, then the floor the two of them are standing on. The horizon sits
    #  low so the crawlers break it: a figure standing entirely inside one
    #  band of colour reads as pasted on.
    horizon = 440
    s.vgradient(0, 0, W, horizon, sky_top, RAMPS['cloth_purple'][1])
    s.tile(art['tex_floor_a'], 0, horizon, W, H - horizon, 4)
    s.vgradient(0, horizon, W, 40, sky_bot, RAMPS['cloth_purple'][0])

    #  A shaft of light down the middle, which is where the stairs are and
    #  what everything on the cover is arranged around. It starts at the top
    #  edge rather than partway down: begun in open sky it has a hard top
    #  border and reads as a trapezium someone drew, not as light.
    rows = horizon - 24
    for i in range(rows):
        t = i / float(rows - 1)
        wide = int(120 + 210 * t)
        k = 0.42 * (1.0 - t) ** 0.7
        c = tuple(int(round(RAMPS['arcane'][3][j] * k + sky_top[j] * (1 - k)))
                  for j in range(3))
        s.rect(W // 2 - wide // 2, 24 + i, wide, 1, c)

    #  The two of them, four times up, standing on the floor line.
    s.blit(art['carl'], W // 2 - 128 - 8, horizon - 64 * 4 + 20, 4)
    s.blit(art['donut'], W // 2 + 8, horizon - 64 * 4 + 20, 4)

    #  The System's frame. Amber, hard, and inside the bleed, because this is
    #  a broadcast overlay and not a border on a poster.
    s.rect(0, 0, W, 10, INK['ink'])
    s.rect(0, H - 10, W, 10, INK['ink'])
    s.rect(0, 0, 10, H, INK['ink'])
    s.rect(W - 10, 0, 10, H, INK['ink'])
    s.rect(10, 10, W - 20, 4, UI['amber'])
    s.rect(10, H - 14, W - 20, 4, UI['amber'])
    s.rect(10, 10, 4, H - 20, UI['amber'])
    s.rect(W - 14, 10, 4, H - 20, UI['amber'])

    #  Title. Two lines, because "DUNGEON CRAWLER CARL" set on one line at a
    #  readable size is wider than the box.
    for line, y, zoom, colour in (("DUNGEON", 40, 9, UI['ink']),
                                  ("CRAWLER CARL", 124, 6, UI['amber'])):
        w = s.text_width(line, zoom)
        x = (W - w) // 2
        s.text(glyphs, line, x + zoom, y + zoom, zoom, INK['ink'])   # drop shadow
        s.text(glyphs, line, x, y, zoom, colour)

    #  The strap line, on a black bar so it survives whatever is behind it.
    #  The strap line, on a bar so it survives whatever is behind it. Sized
    #  to the box rather than to a number: at zoom 3 it is wider than the
    #  cover and loses a word off each end, which is how it first shipped.
    strap = "EIGHTEEN FLOORS. NOBODY HAS SHOES."
    zoom = 3
    while zoom > 1 and s.text_width(strap, zoom) > W - 60:
        zoom -= 1
    w = s.text_width(strap, zoom)
    s.rect((W - w) // 2 - 12, H - 76, w + 24, 7 * zoom + 14, INK['ink'])
    s.text(glyphs, strap, (W - w) // 2, H - 69, zoom, UI['ink'])

    #  What it runs on, top right, the way a spine tag would carry it.
    tag = "NINTENDO DS  HOMEBREW"
    zoom = 2
    w = s.text_width(tag, zoom)
    s.rect(W - w - 34, H - 118, w + 16, 7 * zoom + 10, INK['ink'])
    s.text(glyphs, tag, W - w - 26, H - 113, zoom, UI['amber_dk'])

    png.write_rgb(path, W, H, s.px)
    return path


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'dist', 'cover.png')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    print("  cover: %s" % build(out))
