"""The dungeon's floor and wall tiles.

tools/art/gba.py draws them, in the same flat GBA style as the battle
arenas, and writes each to assets/tiles as a 32 x 32 indexed PNG of at most
32 colours, sorted dark to light. This reads them, so the build needs no
imaging library.

The five materials, in the order view2d.c and the arenas pick them in:
poured concrete (a parking garage), a tagged shelter, old stone, tenement
brick, and the city at night.
"""

import os

import png
from forge_tools import rgb555

HERE = os.path.dirname(os.path.abspath(__file__))
TILES = os.path.join(HERE, '..', '..', 'assets', 'tiles')


def _tile(name):
    def load():
        w, h, pal, index = png.read_indexed(os.path.join(TILES, name + '.png'))
        assert (w, h) == (32, 32), "%s is %dx%d" % (name, w, h)
        used = max(index) + 1
        #  The tile renderer's lighting tables hold 64 entries a shade.
        assert used <= 32, "%s uses %d colours" % (name, used)
        c = png.Canvas(w, h)
        c.px[:] = index
        return c, [rgb555(p) for p in pal[:used]]
    return load


ROSTER = [('tex_%s_%s' % (kind, m), _tile('tile_%s_%s' % (kind, m)))
          for m in 'abcde' for kind in ('wall', 'floor')]
