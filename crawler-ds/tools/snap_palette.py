#!/usr/bin/env python3
"""Pull every literal colour in the C renderer onto the shared palette.

The art is generated from tools/art/palettes.py, but the renderer draws a
great deal that is not a sprite -- scene backgrounds, cutscene skies, the
safe room's warm light, the arena's rig -- and those were written as literal
RGB triples chosen while looking at the screen. Individually reasonable,
collectively a second palette, and the reason a hand-drawn crawler could
stand in front of a background that did not belong to the same game.

This walks the sources, finds every RGB(r, g, b), and replaces it with the
nearest colour in the curated set, naming what it landed on. Run it after
adding a colour by eye; it is idempotent, because a colour already on the
palette is nearest to itself.

    python3 tools/snap_palette.py src/render/*.c

Matching is the same hue-first metric the sprite forge uses, so a colour
moves to its own family rather than to whatever happens to share its
brightness. Anything already exact is left alone, comment and all.
"""
import re
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'art'))
from palettes import RAMPS, INK, UI, _hsl                       # noqa: E402

#  Everything a colour is allowed to become, and what to call it.
CATALOGUE = []
for _name, _entries in RAMPS.items():
    for _i, _c in enumerate(_entries):
        CATALOGUE.append((_c, '%s %d' % (_name, _i)))
for _name, _c in INK.items():
    CATALOGUE.append((_c, 'ink %s' % _name))
for _name, _c in UI.items():
    CATALOGUE.append((_c, 'ui %s' % _name))


def snap(rgb):
    bh, bs, bl = _hsl(rgb)
    best, best_d = None, None
    for c, label in CATALOGUE:
        h, s, lum = _hsl(c)
        dh = abs(bh - h)
        dh = min(dh, 360.0 - dh)
        chroma = min(bs, s)
        d = (dh * chroma * 2.2) ** 2
        d += ((bs - s) * 260.0) ** 2
        d += ((bl - lum) * 200.0) ** 2
        if best_d is None or d < best_d:
            best, best_d = (c, label), d
    return best


PATTERN = re.compile(r'RGB\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)')


def convert(path):
    src = open(path).read()
    moved = [0]

    def one(m):
        rgb = tuple(int(m.group(i)) for i in (1, 2, 3))
        (r, g, b), label = snap(rgb)
        if (r, g, b) != rgb:
            moved[0] += 1
        return 'RGB(%d, %d, %d) /* %s */' % (r, g, b, label)

    out = PATTERN.sub(one, src)
    #  A second pass would otherwise stack comments.
    out = re.sub(r'(/\* [a-z_]+ [0-9a-z_]+ \*/)(\s*/\* [a-z_]+ [0-9a-z_]+ \*/)+',
                 r'\1', out)
    if out != src:
        open(path, 'w').write(out)
    return moved[0], len(PATTERN.findall(src))


if __name__ == '__main__':
    for p in sys.argv[1:]:
        moved, total = convert(p)
        print('  %-28s %3d colours, %d moved onto the palette' % (p, total, moved))
