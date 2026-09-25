"""Overworld sprites: the party as seen from above and in front.

Sixteen by twenty, three facings each, four crawlers. Twenty rather than
twenty-four because the leader and the follower stand one tile apart and tiles
are sixteen pixels: any taller and the two of them overlap into a single totem
instead of reading as two people, one behind the other.

The figures themselves are drawn by hand in ow_grids.py, to the handheld
overworld's conventions. This file animates them: the grid is everything down
to the hips, the legs are drawn here per frame, and the walk is the legs
stepping under a body that dips a pixel as each foot lands.

Facings are down, up and side; the side one is mirrored for the other
direction at draw time rather than stored twice.
"""

import os
import sys

import png
import ow_grids as G
from forge_tools import rgb555

W, H = 16, 20
DOWN, UP, SIDE = 0, 1, 2
GROUND = 19          # the row every foot rests its outline on

#  A stride, six frames of it, and a breath, four.
#
#  Each pose steps one group of legs and holds the other, and drops the body a
#  pixel on the frames where the weight lands. The ground line does not move:
#  a bob lowers everything above the hips toward feet that stay where they
#  are, which is what a step actually does.
#
#  (a_dx, b_dx, a_lift, b_lift, bob) -- 'a' and 'b' are the two leg groups:
#  left and right for a biped, the diagonal pairs of a trotting cat. dx is
#  only used side on, where a leg reaching forward is visible; seen from the
#  front a step is the foot lifting.
WALK = [
    (-1,  1, 0, 0, 0),   # 0  contact: a behind, b ahead
    ( 0,  1, 0, 0, 1),   # 1  down: b takes the weight
    ( 0,  0, 1, 0, 0),   # 2  passing: a comes through, off the floor
    ( 1, -1, 0, 0, 0),   # 3  contact, mirrored
    ( 1,  0, 0, 0, 1),   # 4  down
    ( 0,  0, 0, 1, 0),   # 5  passing, mirrored
]

#  Standing still is not standing frozen: one pixel of rise and fall through
#  the shoulders, held longest at the top.
IDLE = [
    (0, 0, 0, 0, 0),
    (0, 0, 0, 0, 0),
    (0, 0, 0, 0, 1),
    (0, 0, 0, 0, 0),
]


class Ow:
    def __init__(self, pal):
        self.c = png.Canvas(W, H)
        self.keys = {}
        self.pal = [(0, 0, 0)]          # 0 is transparent
        self.src = pal

    def ink(self, key):
        """Keys are names; the palette is colours. Two keys for one colour --
        an eye the same near-black as the outline -- share a slot, because a
        4bpp sprite has fifteen of them and no more."""
        if key not in self.keys:
            rgb = tuple(int(v) for v in self.src[key])
            if rgb not in self.pal[1:]:
                self.pal.append(rgb)
            self.keys[key] = self.pal.index(rgb, 1)
        return self.keys[key]

    def px(self, x, y, key):
        if 0 <= x < W and 0 <= y < H:
            self.c.px[y * W + x] = self.ink(key)

    def emit(self):
        assert len(self.pal) <= 16, "an overworld sprite is a 4bpp sprite too"
        pal = self.pal + [(0, 0, 0)] * (16 - len(self.pal))
        return self.c, [rgb555(c) for c in pal[:16]]


def _leg(o, x, top, lift, fill, shade):
    """Two pixels of leg between two of outline, down to a foot on the floor.
    The right-hand pixel is the shaded side, as everything else is."""
    foot = GROUND - lift
    for y in range(top, foot):
        o.px(x - 1, y, 'o')
        o.px(x, y, fill)
        o.px(x + 1, y, shade)
        o.px(x + 2, y, 'o')
    for dx in range(-1, 3):
        o.px(x + dx, foot, 'o')


def figure(spec, facing, pose):
    grid = spec['grids'][facing]
    a_dx, b_dx, a_lift, b_lift, bob = pose
    if facing != SIDE:
        a_dx = b_dx = 0
    o = Ow(spec['pal'])
    top = len(grid) - 1                 # legs start under the last body row
    #  Legs first, so the body covers their tops as it dips.
    legs = spec['legs'][facing]
    order = sorted(legs, key=lambda l: l.get('z', 0))
    for leg in order:
        dx, lift = (a_dx, a_lift) if leg['group'] == 'a' else (b_dx, b_lift)
        _leg(o, leg['x'] + dx, top, lift, leg.get('fill', spec['leg']),
             leg.get('shade', spec['leg_shade']))
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch != '.':
                o.px(x, y + bob, ch)
    return o


CAST = {
    'carl': dict(
        pal=G.CARL_PAL, leg='s', leg_shade='S',
        grids={DOWN: G.CARL_DOWN, UP: G.CARL_UP, SIDE: G.CARL_SIDE},
        legs={DOWN: [dict(x=5, group='a'), dict(x=8, group='b')],
              UP: [dict(x=5, group='b'), dict(x=8, group='a')],
              SIDE: [dict(x=6, group='a', z=0), dict(x=8, group='b', z=1)]}),
    #  Four legs, trotting: the diagonal pairs move together. Head-on and
    #  from behind only the near pair shows under the body.
    'donut': dict(
        pal=G.DONUT_PAL, leg='c', leg_shade='C',
        grids={DOWN: G.DONUT_DOWN, UP: G.DONUT_UP, SIDE: G.DONUT_SIDE},
        legs={DOWN: [dict(x=4, group='a'), dict(x=9, group='b')],
              UP: [dict(x=4, group='b'), dict(x=9, group='a')],
              SIDE: [dict(x=3, group='b', z=0, fill='d', shade='D'),
                     dict(x=11, group='a', z=0, fill='d', shade='D'),
                     dict(x=2, group='a', z=1, fill='f', shade='d'),
                     dict(x=10, group='b', z=1, fill='c', shade='C')]}),
    #  The robe reaches the floor; what walks under it is a pair of boots.
    'mordecai': dict(
        pal=G.MORD_PAL, leg='k', leg_shade='o',
        grids={DOWN: G.MORD_DOWN, UP: G.MORD_UP, SIDE: G.MORD_SIDE},
        legs={DOWN: [dict(x=5, group='a'), dict(x=8, group='b')],
              UP: [dict(x=5, group='b'), dict(x=8, group='a')],
              SIDE: [dict(x=6, group='a', z=0), dict(x=8, group='b', z=1)]}),
    'bopca': dict(
        pal=G.BOPCA_PAL, leg='s', leg_shade='S',
        grids={DOWN: G.BOPCA_DOWN, UP: G.BOPCA_UP, SIDE: G.BOPCA_SIDE},
        legs={DOWN: [dict(x=5, group='a'), dict(x=8, group='b')],
              UP: [dict(x=5, group='b'), dict(x=8, group='a')],
              SIDE: [dict(x=6, group='a', z=0), dict(x=8, group='b', z=1)]}),
}

ROSTER_NAMES = ('carl', 'donut', 'mordecai', 'bopca')

#  Six walk frames then four idle frames, in that order, for each facing.
#  The renderer indexes them arithmetically off the first, so the order here
#  is the contract -- see OW_FRAMES in src/render/view2d.c.
WALK_FRAMES_N = len(WALK)
IDLE_FRAMES_N = len(IDLE)
FRAMES_N = WALK_FRAMES_N + IDLE_FRAMES_N


def make(name, facing, frame=0):
    pose = WALK[frame] if frame < WALK_FRAMES_N else IDLE[frame - WALK_FRAMES_N]
    return figure(CAST[name], facing, pose).emit()


ROSTER = [('ow_%s_%s_%d' % (n, f, k), (lambda n=n, i=i, k=k: make(n, i, k)))
          for n in ROSTER_NAMES
          for i, f in ((DOWN, 'down'), (UP, 'up'), (SIDE, 'side'))
          for k in range(FRAMES_N)]


def preview(path, names=None, scale=8):
    """Every frame of every facing, big, on a checker -- and a strip of floor
    at the scale the DS shows it, because a sprite that reads at eight times
    can still vanish at two."""
    names = names or [n for n in ROSTER_NAMES if n in CAST]
    cols, rows = FRAMES_N, len(names) * 3
    pad = 2
    cw, ch = (W + pad) * scale, (H + pad) * scale
    out_w, out_h = cols * cw, rows * ch
    buf = bytearray(out_w * out_h * 3)
    for y in range(out_h):
        for x in range(out_w):
            v = 0x2c if ((x // (scale * 2)) + (y // (scale * 2))) & 1 else 0x34
            buf[(y * out_w + x) * 3:(y * out_w + x) * 3 + 3] = bytes((v, v, v + 6))
    for r, name in enumerate(names):
        for f in (DOWN, UP, SIDE):
            for k in range(FRAMES_N):
                o = figure(CAST[name], f, WALK[k] if k < WALK_FRAMES_N
                           else IDLE[k - WALK_FRAMES_N])
                ox, oy = k * cw + pad * scale // 2, (r * 3 + f) * ch + pad * scale // 2
                for y in range(H):
                    for x in range(W):
                        i = o.c.px[y * W + x]
                        if not i:
                            continue
                        rgb = o.pal[i]
                        for yy in range(scale):
                            for xx in range(scale):
                                p = ((oy + y * scale + yy) * out_w + ox + x * scale + xx) * 3
                                buf[p:p + 3] = bytes(rgb)
    png.write_rgb(path, out_w, out_h, buf)


if __name__ == '__main__':
    for name in ROSTER_NAMES:
        for f, g in CAST[name]['grids'].items():
            G.check('%s_%d' % (name, f), g, len(g))
    preview(sys.argv[1] if len(sys.argv) > 1 else '/tmp/ow.png',
            sys.argv[2].split(',') if len(sys.argv) > 2 else None,
            int(sys.argv[3]) if len(sys.argv) > 3 else 8)
