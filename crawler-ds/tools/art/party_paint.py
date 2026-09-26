"""Mordecai and the Bopca, sculpted and lit like the bosses (see sculpt.py).

Carl and Donut come from reference art; these two are built, at the three
sizes the game shows the party at, and written in the same format the
reference importer writes -- `mordecai_ref.py`, `bopca_ref.py` -- so cast.py
stands all four in the party frame the same way.

    python3 tools/art/party_paint.py            # both
    python3 tools/art/party_paint.py mordecai

What they look like is the book's. Mordecai is a Changeling and the dungeon
hands him a new body every floor; the party sprite is the one he has when
Carl and Donut meet him, on the first floor: a Rat Hooligan -- short,
bearded, shaggy grey fur, a long snout, dark clever eyes, a black vest, blue
trousers and worn sandals on clawed feet, hands always wringing. A Bopca is
stout, green-tinted, hairy and dwarfish, and smells of wet moss; they are
good cooks, which is what the apron is for.
"""

import math
import os
import sys

from sculpt import Scene, Mat, Ellipsoid, Sphere, Limb, Slab
from boss_paint import both, mix, _tentacle

HERE = os.path.dirname(os.path.abspath(__file__))
SIZES = (0.72, 1.0, 1.5)          # cast.SMALL, standard, cast.LARGE


def pick(k, small, mid, large):
    """One of three hand-drawn versions of a feature, by size."""
    return small if k < 0.9 else large if k > 1.2 else mid


# ---------------------------------------------------------------- mordecai --

def mordecai(k=1.0):
    W, H = 44, 58
    s = Scene(W, H, seed=5, k=k)
    n = s.noise
    cx = 22

    def grey(x, y):
        g = n.fbm(x * 0.5, y * 0.5, 2)
        return mix((164, 160, 166), (108, 104, 114), (g - 0.35) * 1.6)

    shag = lambda x, y: 0.6 * n.at(x * 2.4, y * 0.7)     # fur that runs downward
    fur = Mat(grey, spec=0.1, wrap=0.4, bump=shag, bump_k=1.2)
    beard = Mat(lambda x, y: mix((206, 204, 206), (150, 148, 154), n.fbm(x * 0.6, y * 0.6) * 1.5 - 0.3),
                spec=0.1, wrap=0.45, bump=shag, bump_k=1.4)
    pink = Mat((222, 160, 164), spec=0.35, shine=16, wrap=0.35)
    vest = Mat((42, 40, 48), spec=0.35, shine=18, wrap=0.2)
    denim = Mat(lambda x, y: mix((70, 96, 160), (50, 70, 124), n.fbm(x * 0.7, y * 0.7)),
                spec=0.1, wrap=0.3, bump=lambda x, y: 0.3 * n.at(x * 3.0, y * 3.0))
    leather = Mat((122, 84, 52), spec=0.25, shine=12, wrap=0.3)

    #  The tail, behind, out to his left and along the floor.
    tail, _ = _tentacle([(27, 42), (34, 47), (39, 53), (40, 57), (36, 57.5)], 1.8, 0.6, -4, -2, steps=10)
    s.add(pink, tail, blend=0.5, under=True)

    #  Legs in blue trousers, and the sandals.
    s.add(denim, both(2 * cx, [Limb(cx - 4.5, 38, cx - 5.5, 52, 4.2, 3.2, 5, 5)]), blend=1.5)
    feet = both(2 * cx, [Ellipsoid(cx - 6.5, 55.2, 4.4, 1.9, 2.0, 5)])
    s.add(pink, feet, blend=1)
    s.add(leather, both(2 * cx, [Slab([(cx - 11, 56.4), (cx - 2, 56.4), (cx - 2, 57.8), (cx - 11, 57.8)],
                                      depth=1, bevel=0.5, z=4),
                                 Limb(cx - 9, 54.2, cx - 4, 54.2, 0.6, 0.6, 7, 7)]), blend=0.3)

    #  Body: grey fur down the front, a black vest open over it.
    s.add(fur, [Ellipsoid(cx, 32, 9.5, 10.5, 7, 2), Limb(cx, 34, cx, 40, 8, 7, 3, 3)], blend=2)
    s.add(vest, both(2 * cx, [Slab([(cx - 11, 23.5), (cx - 3.5, 23), (cx - 3, 39), (cx - 10, 38.5)],
                                   depth=2.2, bevel=1.6, z=10.5)]))

    #  Arms, bent in, the hands together at the belly, wringing.
    arm = [Limb(cx - 10, 25.5, cx - 11.5, 33, 3.0, 2.7, 9, 10), Limb(cx - 11.5, 33, cx - 3.5, 38.5, 2.7, 2.3, 10, 13)]
    s.add(fur, arm, blend=1.4)
    s.add(fur, both(2 * cx, arm)[len(arm):], blend=1.4)
    s.add(pink, [Ellipsoid(cx - 1.8, 38.5, 3.0, 2.4, 2.2, 12.5), Ellipsoid(cx + 1.8, 38.2, 3.0, 2.4, 2.2, 13)],
          blend=1.2)

    #  The head: round ears, a skull, a long snout coming at you, a beard.
    ears = both(2 * cx, [Sphere(cx - 8.5, 6.5, 4.0, 6)])
    s.add(fur, ears, blend=0.5)
    s.add(pink, both(2 * cx, [Ellipsoid(cx - 8.5, 6.7, 2.4, 2.4, 1.2, 9.3)]), blend=0.3)
    s.add(fur, [Ellipsoid(cx, 13.5, 8.2, 7.8, 6.5, 8), Ellipsoid(cx, 19, 4.4, 4.6, 6.0, 11.5)], blend=2.2)
    s.add(beard, [Ellipsoid(cx, 24.2, 5.8, 4.2, 3.5, 12), Limb(cx, 25, cx, 29.5, 3.8, 1.6, 12, 11)], blend=1.2)
    s.add(pink, [Sphere(cx, 21.6, 1.5, 16.3)], blend=0.4)

    key = {'k': (0x16, 0x12, 0x18), 'w': (0xff, 0xfa, 0xf2), 'h': (0xe8, 0xe4, 0xe8), 'c': (0xf0, 0xea, 0xdc)}
    ex, ey = s.at(cx - 4.2, 14)
    ex2, _ = s.at(cx + 4.2, 14)
    eye = pick(k, ["kk"], [".k.", "kwk", ".k."], [".kkk.", "kwwkk", "kwkkk", ".kkk."])
    s.stamp(ex - len(eye[0]) // 2, ey - len(eye) // 2, eye, key)
    s.stamp(ex2 - len(eye[0]) // 2, ey - len(eye) // 2, eye, key)
    #  Whiskers either side of the snout.
    wx, wy = s.at(cx - 4.8, 20.5)
    wx2, _ = s.at(cx + 4.8, 20.5)
    wh = pick(k, ["h"], ["hh"], ["hhh.", "...h"])
    s.stamp(wx - len(wh[0]), wy, wh, key)
    s.stamp(wx2 + 1, wy, [r[::-1] for r in wh], key)
    #  Claws on the sandalled toes.
    for fx in (cx - 9, cx + 9):
        px, py = s.at(fx, 55.5)
        s.stamp(px - 1, py, pick(k, ["c"], ["c.c"], ["c.c.c"]), key)
    return s.render(colours=44, sat=1.02)


# ------------------------------------------------------------------- bopca --

def bopca(k=1.0):
    W, H = 42, 46
    s = Scene(W, H, seed=9, k=k)
    n = s.noise
    cx = 21

    def moss(x, y):
        g = n.fbm(x * 0.45, y * 0.45, 3)
        return mix((128, 116, 74), (78, 72, 48), (g - 0.35) * 1.7)

    shag = lambda x, y: 0.8 * n.at(x * 2.2, y * 0.6)
    hair = Mat(moss, spec=0.15, wrap=0.4, bump=shag, bump_k=1.5)
    skin = Mat(lambda x, y: mix((154, 190, 112), (118, 156, 90), n.fbm(x * 0.5, y * 0.5)),
               spec=0.3, shine=14, wrap=0.35)
    apron = Mat(lambda x, y: mix((226, 220, 200), (170, 150, 118), max(0.0, n.fbm(x * 0.4, y * 0.4) - 0.45) * 2.2),
                spec=0.1, wrap=0.35)
    pouch = Mat((130, 88, 50), spec=0.3, shine=14, wrap=0.3)

    #  Short legs, big bare feet.
    s.add(hair, both(2 * cx, [Limb(cx - 5, 36, cx - 6, 42, 4.2, 3.6, 4, 4)]), blend=1.2)
    s.add(skin, both(2 * cx, [Ellipsoid(cx - 7, 44, 4.8, 2.0, 2.2, 5)]), blend=1)

    #  The body: stout, and hair nearly all the way down.
    s.add(hair, [Ellipsoid(cx, 27, 13.5, 12.5, 9, 1), Limb(cx, 30, cx, 37, 11, 9.5, 2, 2)], blend=2.5)
    s.add(apron, [Slab([(cx - 6.5, 23.5), (cx + 6.5, 23.5), (cx + 7.5, 39), (cx - 7.5, 39)],
                       depth=1.8, bevel=1.2, z=12.5)])
    s.add(pouch, [Ellipsoid(cx + 5.5, 34, 2.6, 3.0, 2.0, 14.5)], blend=0.4)
    #  Stubby arms, shaggy to the wrist.
    s.add(hair, both(2 * cx, [Limb(cx - 11, 23, cx - 13, 32, 3.8, 3.3, 7, 8)]), blend=1.4)
    s.add(skin, both(2 * cx, [Ellipsoid(cx - 13.2, 34.5, 3.0, 2.6, 2.4, 9)]), blend=1)

    #  The head, straight into the shoulders: a mane all round a small face,
    #  a fringe over the eyes and a big nose.
    s.add(hair, [Ellipsoid(cx, 12.5, 12, 11, 7, 4)], blend=1.5)
    s.add(skin, [Ellipsoid(cx, 15, 7.6, 6.6, 5.0, 9.5)], blend=1.2)
    s.add(hair, [Ellipsoid(cx, 8.2, 8.5, 3.6, 3.0, 12)] +
          [Limb(cx + d, 7, cx + d * 1.1, 11.2, 1.8, 0.8, 13.5, 13.5) for d in (-5, -2.5, 0, 2.5, 5)],
          blend=0.9)
    s.add(hair, [Ellipsoid(cx, 21.5, 7.5, 3.6, 3.0, 11)] +
          [Limb(cx + d, 21, cx + d * 1.2, 25.5, 1.8, 0.7, 12, 11.5) for d in (-5, -2.5, 0, 2.5, 5)],
          blend=0.9)
    s.add(Mat((176, 196, 120), spec=0.5, shine=16, wrap=0.3), [Sphere(cx, 16.4, 2.6, 13.4)], blend=0.5)

    key = {'k': (0x14, 0x14, 0x10), 'w': (0xff, 0xfa, 0xe8), 'm': (0x3c, 0x30, 0x22)}
    ex, ey = s.at(cx - 3.4, 13.4)
    ex2, _ = s.at(cx + 3.4, 13.4)
    eye = pick(k, ["k"], ["wk", "kk"], [".k.", "kwk", "kkk"])
    s.stamp(ex - len(eye[0]) // 2, ey, eye, key)
    s.stamp(ex2 - len(eye[0]) // 2, ey, eye, key)
    mx, my = s.at(cx, 19.4)
    mouth = pick(k, ["m"], ["mm"], ["mmm"])
    s.stamp(mx - len(mouth[0]) // 2, my, mouth, key)
    return s.render(colours=42, sat=1.02)


def main(names):
    for name in names:
        fn = globals()[name]
        out = ['"""Generated by tools/art/party_paint.py -- do not edit; repaint instead."""',
               '', 'SIZES = [']
        for k in SIZES:
            print('painting', name, k)
            pal, rows = fn(k)
            out.append('    (%r,\n     [' % (pal,))
            out += ['      %r,' % r for r in rows]
            out.append('     ]),')
        out.append(']')
        path = os.path.join(HERE, '%s_ref.py' % name)
        open(path, 'w').write('\n'.join(out) + '\n')
        print('wrote', path)


if __name__ == '__main__':
    main(sys.argv[1:] or ['mordecai', 'bopca'])
