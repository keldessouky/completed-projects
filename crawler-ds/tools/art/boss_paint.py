"""The bosses of book one's floors, sculpted and lit (see sculpt.py).

Each is painted at the height the battle screen shows it -- render.c sizes a
boss to 42 + bulk * 38 / 255 pixels -- so it is drawn one to one and never
resampled. A scene is two pixels shorter than that, for the outline, and
content.c's bulk column has to agree with it; hostsim checks that it does.
(The Rage Elemental is not a boss by rank, so it is sized as a mob is: it
fills the whole band, seventy-four pixels.)

    python3 tools/art/boss_paint.py            # repaint all, write boss_ref.py
    python3 tools/art/boss_paint.py juicer     # just the one

What each looks like is from the books, as far as the books say. Where they
do not -- a colour nobody names -- the choice is the one that reads at sixty
pixels on a dark floor.
"""

import math
import os
import sys

from sculpt import Scene, Mat, Ellipsoid, Sphere, Limb, Slab

HERE = os.path.dirname(os.path.abspath(__file__))


def mirror_x(w, prims):
    """The same primitives reflected across the middle of a `w` wide scene."""
    out = []
    for p in prims:
        if isinstance(p, Ellipsoid):
            out.append(Ellipsoid(w - p.cx, p.cy, p.rx, p.ry, p.rz, p.z))
        elif isinstance(p, Limb):
            out.append(Limb(w - p.a[0], p.a[1], w - p.b[0], p.b[1], p.r0, p.r1,
                            p.z0, p.z1, p.flat))
        elif isinstance(p, Slab):
            out.append(Slab([(w - x, y) for x, y in p.pts], p.depth, p.bevel, p.z))
    return out


def both(w, prims):
    return list(prims) + mirror_x(w, prims)


def mix(a, b, t):
    t = 0.0 if t < 0 else 1.0 if t > 1 else t
    return tuple(a[k] + (b[k] - a[k]) * t for k in range(3))


# ---------------------------------------------------------------- the juicer

def juicer():
    """The Juicer: six and a half feet of troglodyte bodybuilder. A scaly
    lizard head on an improbably beefy neck, beady eyes ringed with zits,
    arms too big to lower all the way and thighs that force a wide stance,
    every inch of it roped with veins. He throws weights; this one is on
    fire."""
    W, H = 74, 62
    s = Scene(W, H, seed=11)
    n = s.noise
    cx = W / 2

    def scales(x, y):
        #  Staggered rows of little domes, broken up so they are not a grid.
        row = math.floor(y / 1.7)
        u = x / 1.9 + (0.5 if row % 2 else 0.0)
        fx, fy = u - math.floor(u) - 0.5, (y / 1.7) - row - 0.5
        return -0.55 * (fx * fx + fy * fy) + 0.25 * n.fbm(x * 0.9, y * 0.9, 2)

    def hide(x, y):
        #  Olive on the back and limbs, going sallow down the front.
        front = max(0.0, 1.0 - ((x - cx) / 12.0) ** 2) * max(0.0, 1.0 - ((y - 30) / 13.0) ** 2)
        base = mix((92, 116, 58), (160, 156, 92), front * 0.6)
        g = n.fbm(x * 0.35, y * 0.35, 3)
        return mix(base, (64, 84, 50), (g - 0.45) * 1.4)

    skin = Mat(hide, spec=0.2, shine=14, bump=scales, bump_k=0.5, wrap=0.3)
    vein = Mat((84, 112, 104), spec=0.35, shine=20, wrap=0.3)

    #  Tail first and underneath: it shows between his legs and off to the
    #  right where the stance opens.
    s.add(skin, [Limb(44, 45, 53, 55, 4.0, 3.2, 1, 0), Limb(53, 55, 63, 59, 3.2, 2.2, 0, 0),
                 Limb(63, 59, 70, 55, 2.2, 1.2, 0, 1)], blend=2.0, z=-6, under=True)

    #  Legs: the thighs are the widest thing about him below the arms.
    leg = [Limb(30, 42, 21, 52, 8.0, 6.0, 7, 6), Sphere(25, 47, 7.2, 3.5),
           Limb(21, 52, 19, 58, 5.2, 3.4, 6, 5), Sphere(21, 54, 4.6, 3),
           Ellipsoid(17.5, 59.6, 5.2, 2.2, 2.6, 4)]
    s.add(skin, both(W, leg), blend=2.5)
    #  Claws on the feet.
    claw = Mat((222, 214, 190), spec=0.4, shine=22)
    for fx in (13.5, 16.5, 19.5):
        s.add(claw, both(W, [Limb(fx, 60.2, fx - 0.8, 61.4, 0.9, 0.5, 7, 7)]), blend=0.5)

    #  Torso: a keg with a chest on it, abs cut in.
    torso = [Ellipsoid(cx, 27, 13.5, 15.5, 10, 2), Limb(cx, 33, cx, 41, 10.0, 9.0, 3, 3)]
    for yy in (29.5, 33.8, 38.0):
        for xx in (cx - 3.1, cx + 3.1):
            torso.append(Ellipsoid(xx, yy, 2.9, 2.1, 1.9, 10.6 - (yy - 29.5) * 0.3))
    torso += both(W, [Ellipsoid(cx - 6.8, 21.5, 7.6, 5.6, 5.0, 9.5)])      # pecs
    s.add(skin, torso, blend=1.2)

    #  Belt and trunks: the belt is a lifter's, the trunks are the smallest
    #  thing he owns.
    trunks = Mat((158, 34, 46), spec=0.45, shine=18, wrap=0.2)
    s.add(trunks, [Slab([(25, 41), (49, 41), (51, 48), (40, 49.5), (37, 46.5), (34, 49.5), (23, 48)],
                        depth=3, bevel=2.2, z=14)])
    leather = Mat((112, 72, 42), spec=0.25, shine=12)
    s.add(leather, [Slab([(24.5, 37.2), (49.5, 37.2), (50.2, 42), (23.8, 42)], depth=2.5,
                         bevel=1.3, z=15)])
    steel = Mat((200, 200, 210), spec=1.0, shine=30)
    s.add(steel, [Slab([(34.2, 37.6), (39.8, 37.6), (39.8, 41.6), (34.2, 41.6)],
                       depth=1.2, bevel=0.8, z=17.2)])

    #  Neck and traps: more neck than head.
    s.add(skin, [Limb(cx, 10, cx, 16, 8.5, 9.5, 5, 6), Limb(cx - 5, 12, 22, 17.5, 4.5, 6.0, 6, 7),
                 Limb(cx + 5, 12, W - 22, 17.5, 4.5, 6.0, 6, 7)], blend=2.5)

    #  Arms, held out from the body because they will not go any closer.
    arm = [Sphere(18.5, 19.5, 6.8, 9.5),                   # deltoid
           Limb(17, 21, 10, 32, 5.6, 5.0, 10, 9), Sphere(12.8, 26.0, 5.2, 10.5),  # biceps
           Limb(10, 32, 9, 42, 5.3, 3.6, 9, 11), Sphere(9.2, 35.5, 4.6, 9.5),     # forearm
           Sphere(9.2, 45.2, 4.1, 11.5)]                                         # fist
    s.add(skin, arm, blend=2.2)
    s.add(skin, mirror_x(W, arm), blend=2.2)

    #  The head: small next to all that neck, lizard-wide, the eyes up on
    #  bulges at the corners of the skull.
    head = [Ellipsoid(cx, 7.0, 7.6, 5.8, 5.0, 12.5), Ellipsoid(cx, 9.8, 4.6, 3.4, 4.0, 14.2),
            Ellipsoid(cx, 12.4, 6.6, 2.6, 2.6, 13.0)]
    head += both(W, [Sphere(cx - 4.6, 5.2, 2.4, 13.8)])
    s.add(skin, head, blend=1.6)
    #  The weight: an iron dumbbell in his left fist.
    iron = Mat((80, 80, 92), spec=0.8, shine=26, wrap=0.1)
    s.add(iron, [Limb(58.5, 45.2, 71.5, 45.2, 1.1, 1.1, 16, 16),
                 Ellipsoid(58.5, 45.2, 1.9, 5.6, 3.0, 15), Ellipsoid(71.2, 45.2, 1.9, 5.6, 3.0, 15)],
          blend=0.8)
    s.add(skin, [Sphere(W - 9.2, 45.2, 4.1, 13.5)], blend=1)

    #  The veins, laid over everything built so far: up the forearms, over
    #  the biceps, across the delts and the pecs, down the thighs.
    veins = [[(8.0, 42.5), (8.6, 39.0), (7.6, 36.0), (9.2, 33.5)],
             [(10.8, 41.5), (11.4, 38.0), (10.2, 35.0)],
             [(11.0, 31.5), (12.6, 28.5), (11.8, 25.5), (13.6, 22.5), (16.5, 18.5)],
             [(12.6, 28.5), (15.0, 27.0)],
             [(20.0, 15.5), (18.4, 19.0), (19.8, 22.5)],
             [(cx - 11.0, 18.5), (cx - 8.0, 21.0), (cx - 6.5, 24.5)],
             [(cx - 8.0, 21.0), (cx - 4.5, 19.5)],
             [(26.0, 44.5), (24.0, 48.0), (25.0, 51.0), (22.5, 53.5)],
             [(cx - 3.5, 12.5), (cx - 5.5, 15.5)]]
    veins += [[(W - x, y) for x, y in path] for path in veins]
    s.cords(Mat((104, 118, 150), spec=0.5, shine=20, wrap=0.3), veins)

    #  The face, by hand: beady eyes ringed with zits, nostrils, and a mouth
    #  the width of the skull.
    key = {'k': (0x16, 0x10, 0x0c), 'w': (0xff, 0xf4, 0xd8), 'y': (0xf0, 0xcc, 0x62),
           'r': (0xd4, 0x50, 0x3e), 'm': (0x3c, 0x1c, 0x18), 't': (0xe8, 0xe0, 0xc4)}
    for ex in (31, 42):
        s.stamp(ex, 5, ["wk", "kk"], key)
    s.stamp(29, 4, ["...y", "r...", ".....", "..r.y"], key)
    s.stamp(41, 4, ["y...", "....r", ".....", "y.r.."], key)
    s.stamp(36, 9, ["k.k"], key)
    s.stamp(31, 11, ["m..........m", ".mmmmmmmmmm.", "..t.....t..."], key)
    return s.render()

# ---------------------------------------------------------------- the hoarder

def _garbage(s, rng, x0, x1, top, bottom, n=70, z0=0.0, mound=1.0, size=1.0):
    """A heap of somebody's whole life: bin bags, boxes, cans, bottles,
    newspaper, takeaway tubs, a tyre. Piled on a mound of grime so that
    every item sits on what is under it. Big and bright enough to read as
    things at this size, rather than as gravel."""
    grime = Mat(lambda x, y: mix((74, 58, 46), (48, 40, 36), s.noise.fbm(x * 0.3, y * 0.3)),
                bump=lambda x, y: s.noise.fbm(x * 0.8, y * 0.8), bump_k=2.0)
    cxm, w = (x0 + x1) / 2.0, (x1 - x0) / 2.0
    s.add(grime, [Ellipsoid(cxm, bottom, w, bottom - top, 10 * mound, z0)], blend=1)
    wrinkle = lambda x, y: 0.6 * s.noise.at(x * 1.4, y * 0.7)
    bags = [Mat((44, 44, 52), spec=0.5, shine=10, wrap=0.1, bump=wrinkle, bump_k=1.5),
            Mat((60, 92, 66), spec=0.5, shine=10, wrap=0.1, bump=wrinkle, bump_k=1.5),
            Mat((206, 204, 196), spec=0.4, shine=10, wrap=0.2, bump=wrinkle, bump_k=1.5)]
    card = Mat(lambda x, y: mix((204, 158, 96), (160, 116, 68), s.noise.at(x, y * 3)), wrap=0.3)
    loud = [(204, 58, 50), (232, 186, 60), (64, 120, 204), (236, 236, 228), (96, 176, 92),
            (220, 110, 170)]
    paper = Mat((230, 226, 210), wrap=0.4)
    glass = Mat((70, 150, 92), spec=1.2, shine=40)
    tyre = Mat((42, 40, 42), spec=0.3, shine=10)
    for _ in range(n):
        x = rng.uniform(x0 + 3, x1 - 3)
        #  Only where the mound is: an ellipse's worth of heap.
        u = (x - cxm) / w
        ytop = bottom - (bottom - top) * math.sqrt(max(0.0, 1 - u * u))
        y = rng.uniform(ytop + 1, min(bottom - 1, ytop + 14))
        h = s.height_at(x, y)
        if h is None:
            continue
        k = rng.random()
        a = rng.uniform(-0.6, 0.6)
        ca, sa = math.cos(a), math.sin(a)
        z = size
        if k < 0.24:
            r = rng.uniform(3.5, 5.5) * z
            s.add(rng.choice(bags),
                  [Ellipsoid(x, y, r * rng.uniform(1.0, 1.3), r, r * 0.8, h - r * 0.2),
                   Limb(x, y - r * 0.9, x + rng.uniform(-1, 1), y - r * 1.3, 1.0, 0.7, h + 1.5, h + 1.5)],
                  blend=1.2)
        elif k < 0.46:
            bw, bh = rng.uniform(3.5, 6.0) * z, rng.uniform(2.8, 4.5) * z
            pts = [(x + ca * dx - sa * dy, y + sa * dx + ca * dy)
                   for dx, dy in ((-bw, -bh), (bw, -bh), (bw, bh), (-bw, bh))]
            box = Mat(rng.choice((card.col, card.col, rng.choice(loud))), wrap=0.3)
            s.add(box, [Slab(pts, depth=4.0, bevel=1.0, z=h - 1)])
        elif k < 0.58:
            pts = [(x + rng.uniform(-4, 4) * z, y + rng.uniform(-2.5, 2.5) * z) for _ in range(5)]
            pts.sort(key=lambda p: math.atan2(p[1] - y, p[0] - x))
            s.add(paper, [Slab(pts, depth=1.0, bevel=0.7, z=h + 0.3)])
        elif k < 0.80:
            L = rng.uniform(2.2, 3.8) * z
            tin = Mat(rng.choice(loud), spec=0.9, shine=30)
            a = rng.uniform(0, math.pi)
            ca, sa = math.cos(a), math.sin(a)
            s.add(rng.choice((tin, tin, glass)),
                  [Limb(x - ca * L, y - sa * L, x + ca * L, y + sa * L, 1.4 * z, 1.4 * z, h + 0.5, h + 0.5)],
                  blend=0.5)
        elif k < 0.92:
            s.add(Mat(rng.choice(loud), spec=0.5, shine=20),
                  [Ellipsoid(x, y, 3.0 * z, 2.0 * z, 1.6, h + 0.2)], blend=0.5)
        else:
            s.add(tyre, [Ellipsoid(x, y, 4.6 * z, 3.2 * z, 2.0, h + 0.4)], blend=0.5)
            s.add(grime, [Ellipsoid(x, y, 2.2 * z, 1.5 * z, 0.6, h + 1.5)], blend=0.5)


def hoarder():
    """The Hoarder: a woman of about thirty-five turned into fifteen feet of
    garbage troll, stuck fast in everything she ever kept. Pale skin covered
    in sores and scabs and stretch marks, greasy black hair in clumps, one
    side of her face burned and the other streaming tears, one misshapen
    tooth. A filthy ripped T-shirt, and tight blue sweatpants with PINK down
    the leg. She coughs up Scatterers; one is on its way out."""
    import random
    W, H = 104, 77
    s = Scene(W, H, seed=23)
    n = s.noise
    rng = random.Random(5)
    cx = 52

    def pale(x, y):
        g = n.fbm(x * 0.4, y * 0.4, 3)
        return mix((222, 184, 164), (190, 140, 132), (g - 0.4) * 1.6)

    skin = Mat(pale, spec=0.3, shine=12, wrap=0.3,
               bump=lambda x, y: 0.4 * n.fbm(x * 0.7, y * 0.7, 2))

    #  Behind her, the heap goes up the wall.
    _garbage(s, rng, -10, 40, 26, 82, n=30, z0=-16)
    _garbage(s, rng, 64, W + 10, 26, 82, n=30, z0=-16)

    #  The body: a gut like a boulder, a chest, shoulders.
    body = [Ellipsoid(cx, 52, 26, 18, 16, 0), Ellipsoid(cx, 35, 21, 12, 13, 2)]
    body += both(2 * cx, [Ellipsoid(cx - 10.5, 38.5, 10, 8.5, 7, 10)])       # breasts
    body += both(2 * cx, [Sphere(cx - 19, 29.5, 7.5, 3)])                   # shoulders
    torso = s.add(skin, body, blend=3)

    #  The T-shirt: what is left of one, over the chest and not the gut.
    def shirt_area(x, y):
        edge = 45 + 2.4 * math.sin(x * 0.8) + 3.0 * n.at(x * 0.5, 3)
        return y < edge
    s.decal(shirt_area, lambda x, y: mix((150, 154, 168), (104, 98, 84),
                                         n.fbm(x * 0.45, y * 0.45) * 1.5 - 0.4), part=torso)

    #  The leg that is still out of the pile, in the sweatpants.
    sweats = Mat(lambda x, y: mix((70, 98, 176), (44, 62, 130), n.fbm(x * 0.5, y * 0.5)),
                 spec=0.15, wrap=0.35, bump=lambda x, y: 0.5 * n.at(x * 1.3, y * 0.4))
    s.add(sweats, [Limb(62, 60, 82, 65, 9, 7.5, 14, 16), Limb(82, 65, 89, 72, 7.0, 5.5, 16, 14)],
          blend=2)
    s.add(skin, [Ellipsoid(90.5, 74.5, 5, 2.6, 2.6, 16)], blend=1)          # a bare foot

    #  The heap she is sunk in, in front of her: up to her gut in the
    #  middle, higher at the sides.
    _garbage(s, rng, -8, 40, 56, 90, n=34, z0=6, mound=0.5, size=1.15)
    _garbage(s, rng, 26, 72, 66, 92, n=18, z0=10, mound=0.5, size=1.15)
    _garbage(s, rng, 90, W + 14, 54, 90, n=14, z0=6, mound=0.5, size=1.15)

    #  Arms, fat, hanging at her sides and then laid out on the rubbish.
    arm = [Limb(cx - 20, 30, cx - 26, 46, 8.0, 7.0, 10, 13), Ellipsoid(cx - 25.5, 40, 7.2, 8.5, 6, 10),
           Limb(cx - 26, 46, cx - 33, 56, 6.4, 4.8, 13, 18)]
    hand = [Ellipsoid(cx - 35, 58.5, 4.8, 3.4, 3.0, 18)]
    hand += [Limb(cx - 38.5 + k * 2.1, 59, cx - 39.5 + k * 2.3, 62, 1.1, 0.9, 19.5, 19) for k in range(4)]
    s.add(skin, arm, blend=2.5)
    s.add(skin, mirror_x(2 * cx, arm), blend=2.5)
    s.add(skin, hand, blend=1.2)
    s.add(skin, mirror_x(2 * cx, hand), blend=1.2)

    #  Sores and scabs on everything that is skin.
    skin_at = lambda x, y: (s.mat[int(y * s.ss) * s.W + int(x * s.ss)] is skin
                            and s.paint.get(int(y * s.ss) * s.W + int(x * s.ss)) is None)
    for _ in range(40):
        x, y = rng.uniform(4, W - 4), rng.uniform(26, 70)
        r = rng.uniform(0.6, 1.2)
        s.decal(lambda px, py, x=x, y=y, r=r: (px - x) ** 2 + (py - y) ** 2 < r * r and skin_at(px, py),
                rng.choice(((150, 48, 46), (112, 42, 36), (176, 80, 70))))
    #  Stretch marks across the gut.
    for k in range(4):
        y0 = 50 + k * 3.2
        s.decal(lambda x, y, y0=y0: abs(y - y0 - 0.15 * (x - cx)) < 0.3 and 13 < abs(x - cx) < 23
                and skin_at(x, y), (238, 212, 204))

    #  Hair behind the head, hanging to the shoulders in clumps.
    hair = Mat((36, 32, 40), spec=0.9, shine=22, wrap=0.2)
    back = [Ellipsoid(cx, 12, 12.5, 11, 6, 8)]
    for dx in (-12.5, -10.5, -8.5, 8.5, 10.5, 12.5):
        back.append(Limb(cx + dx * 0.85, 10, cx + dx, 26 + abs(dx) * 0.5, 2.6, 1.6, 12, 16))
    s.add(hair, back, blend=1.5)
    #  Head, with the chins under it.
    head = [Ellipsoid(cx, 14, 10, 11, 8, 14), Ellipsoid(cx, 24, 9.5, 3.6, 4, 15),
            Ellipsoid(cx, 21, 8, 3.4, 3, 18)]
    face = s.add(skin, head, blend=2)
    #  The burn down her left side (the viewer's right... no: her left is
    #  the viewer's right; the burn is on the side toward the light, where
    #  it reads).
    s.decal(lambda x, y: x < cx - 2.5 - 1.5 * n.at(0, y * 0.5) and 7 < y < 25,
            lambda x, y: mix((176, 86, 66), (110, 44, 36), n.fbm(x * 0.9, y * 0.9) * 1.4 - 0.2),
            part=face)
    #  A fringe of greasy clumps over the brow.
    s.add(hair, [Ellipsoid(cx, 4.8, 9.5, 3.4, 2.5, 19.5)] +
          [Limb(cx + dx, 4, cx + dx * 1.15, 9.5, 1.6, 1.0, 20, 20.5) for dx in (-7, -3.5, 0.5, 4, 7.5)],
          blend=1.0)
    #  The mouth, wide open, and what is coming out of it.
    s.add(Mat((56, 18, 22), wrap=0.0), [Ellipsoid(cx, 18.6, 3.8, 3.0, 1.0, 21.0)], blend=0.5)
    shell = Mat((132, 86, 42), spec=1.1, shine=30, wrap=0.2)
    s.add(shell, [Ellipsoid(cx + 0.3, 20.6, 2.6, 3.2, 2.0, 21.8), Sphere(cx + 0.3, 17.8, 1.5, 22.2)],
          blend=0.8)

    key = {'k': (0x1a, 0x10, 0x10), 'w': (0xff, 0xf6, 0xe8), 't': (0xf0, 0xe6, 0xc0),
           'b': (0x9a, 0xd4, 0xf4), 'l': (0x2a, 0x1a, 0x12), 'p': (0xf2, 0x86, 0xb8),
           'r': (0x6e, 0x22, 0x1e)}
    s.stamp(46, 12, ["rk", "kr"], key)                            # the burned side
    s.stamp(55, 12, ["wk", "kk"], key)                            # the weeping one
    s.stamp(56, 14, ["b", "b", ".b", ".b", ".b"], key)            # tears
    s.stamp(50, 16, ["t"], key)                                   # the one tooth
    #  The Scatterer's legs, feeling for the air.
    s.stamp(48, 19, ["l.....l", ".l...l.", "l.....l"], key)
    #  PINK, down the sweatpants, following the thigh.
    for dx, dy, glyph in ((0, 0, ["pp.", "p.p", "pp.", "p.."]), (4, 1, ["p", "p", "p", "p"]),
                          (6, 1, ["p..p", "pp.p", "p.pp", "p..p"]), (11, 2, ["p.p", "pp.", "pp.", "p.p"])):
        s.stamp(64 + dx, 58 + dy, glyph, key)
    return s.render(colours=54, sat=1.1)


# ------------------------------------------------------- goblin war chieftain

def warchief():
    """The Goblin War Chieftain: towering and muscular for a goblin, green
    leathery skin, coarse black hair, a heavy brow, sharp teeth, pointed
    ears. Carl did not fight him so much as deliver a cart of explosives to
    him. The axe and the bone-spiked war gear are his station."""
    W, H = 66, 65
    s = Scene(W, H, seed=31)
    n = s.noise
    cx = 35

    def hide(x, y):
        g = n.fbm(x * 0.3, y * 0.3, 3)
        return mix((106, 150, 70), (74, 110, 54), (g - 0.35) * 1.6)

    skin = Mat(hide, spec=0.2, shine=12, wrap=0.3,
               bump=lambda x, y: 0.5 * n.fbm(x * 1.1, y * 1.1, 2), bump_k=0.8)
    leather = Mat(lambda x, y: mix((128, 84, 50), (92, 58, 36), n.fbm(x * 0.6, y * 0.6)),
                  spec=0.2, shine=12, wrap=0.25)
    bone = Mat((230, 220, 190), spec=0.4, shine=20, wrap=0.3)
    iron = Mat(lambda x, y: mix((170, 172, 182), (110, 108, 118), n.fbm(x * 0.5, y * 0.5)),
               spec=1.0, shine=30, wrap=0.1)
    wood = Mat((110, 72, 40), spec=0.2, wrap=0.3,
               bump=lambda x, y: 0.4 * n.at(x * 3, y * 0.4))
    hair = Mat((32, 28, 32), spec=0.5, shine=18, wrap=0.2,
               bump=lambda x, y: 0.6 * n.at(x * 2.2, y * 0.6), bump_k=1.5)

    #  The axe goes behind him first: the haft up past his right shoulder,
    #  the blade over it.
    s.add(wood, [Limb(12, 42, 22, 4, 1.3, 1.2, 4, 2)], blend=0.5)
    s.add(iron, [Slab([(21, 3), (13, 1.2), (6, 3.5), (3, 9), (5, 15), (11, 12), (18, 12), (23, 9)],
                      depth=2.0, bevel=1.6, z=2)])

    #  Legs, wide, wrapped at the shins.
    leg = [Limb(cx - 6, 43, cx - 11, 54, 5.6, 4.4, 5, 5), Sphere(cx - 8.5, 47, 5.2, 3),
           Limb(cx - 11, 54, cx - 12, 61, 4.2, 3.2, 5, 5), Ellipsoid(cx - 13, 62.5, 4.8, 2.0, 2.4, 5)]
    s.add(skin, both(2 * cx, leg), blend=2)
    s.add(leather, both(2 * cx, [Limb(cx - 11, 55.5, cx - 12, 60.5, 4.4, 3.5, 5.4, 5.4)]), blend=0.6)

    #  Torso.
    torso = [Ellipsoid(cx, 29, 12.5, 13, 8, 1), Limb(cx, 34, cx, 42, 8.5, 7.5, 3, 3)]
    torso += both(2 * cx, [Ellipsoid(cx - 5.8, 24.5, 6.5, 4.8, 4.2, 7.5)])      # pecs
    for yy in (31.0, 35.0):
        torso += both(2 * cx, [Ellipsoid(cx - 2.8, yy, 2.6, 1.9, 1.5, 9.4 - (yy - 31) * 0.3)])
    s.add(skin, torso, blend=1.2)

    #  Belt, a skull for a buckle, and a kilt of leather strips.
    s.add(leather, [Slab([(cx - 9.5, 39.5), (cx + 9.5, 39.5), (cx + 10, 43), (cx - 10, 43)],
                         depth=2.2, bevel=1.0, z=10)])
    for k in range(-4, 5):
        x = cx + k * 2.3
        s.add(leather, [Slab([(x - 1.1, 42.5), (x + 1.1, 42.5), (x + 1.2 + k * 0.25, 50.5 - abs(k) * 0.4),
                              (x - 1.0 + k * 0.25, 50.5 - abs(k) * 0.4)], depth=1.4, bevel=0.6,
                             z=10.2 - abs(k) * 0.3)])
    s.add(bone, [Ellipsoid(cx, 41.3, 2.3, 2.2, 1.8, 12)], blend=0.5)

    #  Neck and shoulders.
    s.add(skin, [Limb(cx, 14, cx, 19, 5.5, 7.0, 5, 6),
                 Limb(cx - 4, 18, cx - 13, 21, 3.5, 5.0, 6, 7), Limb(cx + 4, 18, cx + 13, 21, 3.5, 5.0, 6, 7)],
          blend=2)

    #  Arms. His right (the viewer's left) holds the axe; the left is a fist.
    r_arm = [Sphere(cx - 14, 22.5, 5.4, 6), Limb(cx - 15, 24, cx - 19, 33, 4.3, 3.8, 7, 8),
             Sphere(cx - 17.5, 28, 4.0, 5.5), Limb(cx - 19, 33, cx - 22, 41, 3.8, 2.9, 8, 10),
             Sphere(cx - 23, 42.5, 3.3, 9.5)]
    s.add(skin, r_arm, blend=1.8)
    s.add(wood, [Limb(11.5, 44.5, 10.5, 49, 1.3, 1.2, 12, 12)], blend=0.4)
    l_arm = mirror_x(2 * cx, r_arm)
    s.add(skin, l_arm, blend=1.8)
    #  A pauldron on the left shoulder, spiked with bone.
    s.add(leather, [Ellipsoid(cx + 14.5, 21.5, 6.8, 5.2, 4.0, 10)], blend=0.5)
    s.add(bone, [Limb(cx + 12, 18.5, cx + 11, 13.5, 1.3, 0.3, 14, 14),
                 Limb(cx + 16, 18.5, cx + 17, 13, 1.3, 0.3, 14, 14),
                 Limb(cx + 19.5, 20, cx + 22.5, 16, 1.2, 0.3, 13, 13)], blend=0.4)
    #  Bracers.
    s.add(leather, [Limb(cx - 20.5, 36, cx - 21.8, 40, 3.5, 3.2, 9, 10.5),
                    Limb(cx + 20.5, 36, cx + 21.8, 40, 3.5, 3.2, 9, 10.5)], blend=0.5)

    #  Head: heavy brow, jaw, long pointed ears, and a mane of coarse black
    #  hair.
    s.add(hair, [Ellipsoid(cx, 9.5, 9.5, 8.5, 5, 4)] +
          [Limb(cx + dx, 8, cx + dx * 1.35, 21 + abs(dx) * 0.2, 2.6, 1.3, 9, 10.5)
           for dx in (-7.5, -6, 6, 7.5)], blend=1.2)
    ears = [Limb(cx - 5, 10, cx - 15, 5.5, 2.4, 0.4, 8, 7), Limb(cx + 5, 10, cx + 15, 5.5, 2.4, 0.4, 8, 7)]
    s.add(skin, ears, blend=1)
    head = [Ellipsoid(cx, 10.5, 6.2, 6.8, 5.5, 6), Ellipsoid(cx, 14.2, 5.4, 3.0, 3.0, 8.5),
            Ellipsoid(cx, 7.4, 6.0, 2.2, 2.2, 10.4), Ellipsoid(cx, 11.4, 1.8, 2.4, 2.0, 11.2)]
    s.add(skin, head, blend=1.2)
    s.add(hair, [Ellipsoid(cx, 4.6, 6.4, 3.2, 2.6, 9.4)] +
          [Limb(cx + dx, 3.5, cx + dx * 1.25, 0.9, 1.4, 0.5, 10.5, 10.5) for dx in (-4.5, -2, 0.5, 3, 5)],
          blend=0.8)

    key = {'k': (0x16, 0x10, 0x0c), 'y': (0xf4, 0xd0, 0x48), 't': (0xf4, 0xee, 0xd8),
           'm': (0x3a, 0x1a, 0x16)}
    s.stamp(31, 9, ["yk"], key)
    s.stamp(37, 9, ["ky"], key)
    s.stamp(32, 14, ["mmmmmm"], key)
    s.stamp(32, 13, ["t....t"], key)
    s.stamp(33, 15, ["t.tt"], key)
    return s.render(colours=50, sat=1.08)


# -------------------------------------------------------------- ball of swine

def swine():
    """The Ball of Swine: some fifteen feet of Tuskling aristocrats, fused at
    a party into one rolling ball of pink flesh -- eyes, snouts and tusks all
    over it, arms and trotters sticking out, and the scraps of the tuxedos
    and red sequin dresses they had on."""
    import random
    W, H = 86, 78
    s = Scene(W, H, seed=41)
    n = s.noise
    rng = random.Random(9)
    cx, cy, R = 43, 40.5, 36

    def pink(x, y):
        g = n.fbm(x * 0.35, y * 0.35, 3)
        return mix((240, 164, 160), (206, 114, 122), (g - 0.4) * 1.5)

    flesh = Mat(pink, spec=0.45, shine=14, wrap=0.35,
                bump=lambda x, y: 0.3 * n.fbm(x * 0.9, y * 0.9, 2))
    hoof = Mat((74, 52, 56), spec=0.7, shine=22)
    tusk = Mat((246, 238, 214), spec=0.6, shine=24, wrap=0.3)
    tux = Mat((40, 38, 48), spec=0.35, shine=16, wrap=0.2,
              bump=lambda x, y: 0.5 * n.at(x * 1.2, y * 0.5))
    sequin = Mat(lambda x, y: (206, 36, 52) if n.at(x * 2.7, y * 2.7) < 0.7 else (255, 170, 150),
                 spec=1.3, shine=18, wrap=0.2, bump=lambda x, y: 0.7 * n.at(x * 3.3, y * 3.3), bump_k=2.0)
    shirt = Mat((236, 234, 226), spec=0.2, wrap=0.3)

    def on_ball(x, y, lift=0.0):
        d2 = ((x - cx) ** 2 + (y - cy) ** 2) / (R * R)
        return R * math.sqrt(max(0.0, 1 - d2)) + lift

    #  Limbs first, flailing out of the silhouette: arms and legs of the
    #  guests, bent at the elbow and the knee, ending in trotters.
    for a, bend, L in ((205, 25, 15), (245, -30, 13), (300, 30, 12), (338, -25, 14),
                       (22, 30, 13), (150, -28, 14), (118, 24, 11)):
        t = math.radians(a)
        bx, by = cx + math.cos(t) * (R - 6), cy + math.sin(t) * (R - 6)
        mx, my = cx + math.cos(t) * (R + L * 0.35), cy + math.sin(t) * (R + L * 0.35)
        t2 = t + math.radians(bend)
        ex, ey = mx + math.cos(t2) * L * 0.55, my + math.sin(t2) * L * 0.55
        ex, ey = max(3, min(W - 3, ex)), max(3, min(H - 2.5, ey))
        mx, my = max(3.5, min(W - 3.5, mx)), max(3.5, min(H - 3, my))
        s.add(flesh, [Limb(bx, by, mx, my, 3.4, 2.9, 1, 3), Limb(mx, my, ex, ey, 2.9, 2.2, 3, 4)], blend=1.2)
        s.add(hoof, [Ellipsoid(ex, ey, 2.3, 2.3, 1.8, 4.5)], blend=0.8)

    #  The ball itself, and the guests bulging out of it: each one its own
    #  lump, creased where it presses against the next.
    s.add(flesh, [Ellipsoid(cx, cy, R + 1, R, R, 0)], blend=1)
    bodies = [(44, 33, 12.5), (26, 47, 11), (59, 49, 11), (35, 16, 10), (68, 23, 9.5),
              (16, 28, 9.5), (45, 62, 11), (70, 62, 8), (18, 63, 8), (56, 12, 8), (8, 44, 7),
              (78, 40, 7)]
    for k, (x, y, r) in enumerate(bodies):
        tint = [(0, 0, 0), (8, -6, -2), (-10, -8, 0), (6, 4, 0), (-4, -12, -6)][k % 5]
        tone = lambda x, y, t=tint: tuple(v + d for v, d in zip(pink(x, y), t))
        s.add(Mat(tone, spec=0.45, shine=14, wrap=0.35, bump=flesh.bump),
              [Ellipsoid(x, y, r, r * 0.92, r * 0.7, on_ball(x, y) - r * 0.45)], blend=1)

    #  Scraps of what they wore, stretched over the flesh.
    def scrap(mat, x0, y0, rx, ry, rot):
        c, sn = math.cos(rot), math.sin(rot)
        pts = []
        for k in range(9):
            t = 2 * math.pi * k / 9
            wob = 1 + 0.25 * (rng.random() - 0.5)
            u, v = math.cos(t) * rx * wob, math.sin(t) * ry * wob
            pts.append((x0 + u * c - v * sn, y0 + u * sn + v * c))
        return s.add(mat, [Slab(pts, depth=1.4, bevel=1.4, z=(s.height_at(x0, y0) or on_ball(x0, y0)) - 0.2)])
    scrap(tux, 19, 27, 8.5, 5.5, 0.6)
    scrap(shirt, 21.5, 27.5, 1.8, 3.6, 0.6)
    scrap(tux, 60, 62, 9, 4.5, -0.3)
    scrap(tux, 55, 13, 7, 4, 0.2)
    scrap(sequin, 66, 36, 7.5, 6, -0.6)
    scrap(sequin, 33, 48, 8, 5, 0.3)
    scrap(sequin, 13, 47, 4.5, 6.5, 0.2)
    scrap(sequin, 40, 71, 7, 3.2, 0.0)
    s.add(Mat((170, 30, 44), spec=0.6, shine=20), [Ellipsoid(21.5, 24.2, 1.8, 0.9, 0.8,
                                                             (s.height_at(21.5, 24.2) or 20) + 0.6)],
          blend=0.3)    # a bow tie

    #  Faces, on the biggest of the guests: a flat snout with nostrils,
    #  little eyes, ears, and a pair of tusks.
    snout = Mat((226, 118, 132), spec=0.5, shine=16, wrap=0.3)
    ear = Mat((214, 110, 124), spec=0.3, wrap=0.3)
    key = {'k': (0x1c, 0x10, 0x12), 'w': (0xff, 0xf2, 0xea), 'n': (0x5a, 0x1c, 0x2a)}
    for fx, fy, sc in ((44, 33, 1.0), (26, 47, 0.85), (59, 49, 0.85), (35, 16, 0.7), (45, 62, 0.75)):
        h = s.height_at(fx, fy)
        s.add(ear, both(2 * fx, [Slab([(fx - 3.5 * sc, fy - 3.5 * sc), (fx - 8.5 * sc, fy - 8.0 * sc),
                                       (fx - 7.0 * sc, fy - 2.0 * sc)], depth=1.2, bevel=1.0, z=h - 0.8)]))
        s.add(snout, [Ellipsoid(fx, fy + 1.8 * sc, 3.8 * sc, 2.9 * sc, 1.3 * sc, h + 1.8)], blend=0.5)
        s.add(tusk, [Limb(fx - 3.2 * sc, fy + 3.9 * sc, fx - 4.6 * sc, fy + 0.4 * sc, 1.0 * sc, 0.35, h + 2.5, h + 3),
                     Limb(fx + 3.2 * sc, fy + 3.9 * sc, fx + 4.6 * sc, fy + 0.4 * sc, 1.0 * sc, 0.35, h + 2.5, h + 3)],
              blend=0.3)
        gap = int(round(6 * sc))
        ex, ey = int(round(fx - gap / 2.0)) - 1, int(round(fy - 2.6 * sc))
        if sc >= 0.8:
            s.stamp(ex, ey, ["wk", "kk"], key)
            s.stamp(ex + gap, ey, ["wk", "kk"], key)
            s.stamp(int(round(fx - 1.5)), int(round(fy + 1.2 * sc)), ["n.n", "n.n"], key)
        else:
            s.stamp(ex + 1, ey, ["k"], key)
            s.stamp(ex + gap, ey, ["k"], key)
            s.stamp(int(round(fx - 1)), int(round(fy + 1.4 * sc)), ["n.n"], key)
    return s.render(colours=56, sat=1.05)


# ----------------------------------------------------------- krakaren clone

def _tentacle(pts, r0, r1, z0, z1, steps=18):
    """A tapering tentacle through control points (a Catmull-Rom curve), as
    a chain of limbs."""
    def cr(p0, p1, p2, p3, t):
        return tuple(0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t
                            + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t) for k in range(2))
    ext = [pts[0]] + list(pts) + [pts[-1]]
    path = []
    for i in range(len(pts) - 1):
        for j in range(steps):
            path.append(cr(ext[i], ext[i + 1], ext[i + 2], ext[i + 3], j / float(steps)))
    path.append(pts[-1])
    out = []
    N = len(path) - 1
    for i in range(N):
        t0, t1 = i / float(N), (i + 1) / float(N)
        out.append(Limb(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1],
                        r0 + (r1 - r0) * t0, r0 + (r1 - r0) * t1,
                        z0 + (z1 - z0) * t0, z0 + (z1 - z0) * t1))
    return out, path


def krakaren():
    """A Krakaren Clone: a twenty-foot octopus that cannot move from where
    it grew, a beak, and clusters of eyes; fifteen-foot pink tentacles
    covered in human mouths with bright red lips. It shrieks, and it is
    riddled with disease."""
    W, H = 100, 76
    s = Scene(W, H, seed=53)
    n = s.noise
    cx = 50

    def mantle_col(x, y):
        g = n.fbm(x * 0.25, y * 0.25, 3)
        spots = n.at(x * 0.9, y * 0.9)
        base = mix((172, 96, 150), (104, 58, 110), (g - 0.4) * 1.7)
        return mix(base, (196, 204, 112), min(1.0, max(0.0, spots - 0.66) * 4.0))   # sickly blotches

    def tent_col(x, y):
        g = n.fbm(x * 0.3, y * 0.3, 2)
        return mix((238, 150, 164), (204, 110, 136), (g - 0.4) * 1.5)

    mantle = Mat(mantle_col, spec=0.6, shine=16, wrap=0.3,
                 bump=lambda x, y: 0.8 * n.fbm(x * 0.28, y * 0.5, 3), bump_k=1.2)
    tent = Mat(tent_col, spec=0.55, shine=16, wrap=0.35,
               bump=lambda x, y: 0.3 * n.at(x * 1.2, y * 1.2))
    lips = Mat((214, 30, 44), spec=1.0, shine=26, wrap=0.2)

    #  Tentacles behind, going out to either side and down to the floor.
    back = [
        ([(cx - 6, 44), (cx - 22, 40), (cx - 36, 46), (cx - 44, 58), (cx - 40, 66), (cx - 33, 63)], 5.5, 1.5),
        ([(cx + 6, 44), (cx + 22, 40), (cx + 36, 46), (cx + 44, 58), (cx + 40, 66), (cx + 33, 63)], 5.5, 1.5),
        ([(cx - 4, 46), (cx - 16, 52), (cx - 28, 62), (cx - 42, 71), (cx - 47, 67)], 5.0, 1.4),
        ([(cx + 4, 46), (cx + 16, 52), (cx + 28, 62), (cx + 42, 71), (cx + 47, 67)], 5.0, 1.4),
    ]
    paths = []
    for pts, r0, r1 in back:
        prims, path = _tentacle(pts, r0, r1, 2, 4)
        s.add(tent, prims, blend=1.2)
        paths.append((path, r0, r1))

    #  The mantle: a great sagging bag of a head, and the clusters of eyes.
    s.add(mantle, [Ellipsoid(cx, 25, 21, 22, 16, 2), Ellipsoid(cx, 40, 16, 8, 8, 6),
                   Ellipsoid(cx - 8, 18, 9, 10, 5, 11), Ellipsoid(cx + 9, 21, 8, 9, 5, 10)], blend=4)

    #  Tentacles in front: down over the floor, curling.
    front = [
        ([(cx - 7, 45), (cx - 14, 55), (cx - 17, 66), (cx - 26, 73), (cx - 31, 69)], 5.2, 1.4),
        ([(cx + 7, 45), (cx + 14, 55), (cx + 17, 66), (cx + 26, 73), (cx + 31, 69)], 5.2, 1.4),
        ([(cx - 2, 47), (cx - 4, 58), (cx - 1, 68), (cx + 6, 73), (cx + 9, 68)], 4.8, 1.3),
    ]
    for pts, r0, r1 in front:
        prims, path = _tentacle(pts, r0, r1, 10, 8)
        s.add(tent, prims, blend=1.2)
        paths.append((path, r0, r1))

    #  The beak, down among the roots: horn, dark at the hook.
    beak = Mat(lambda x, y: mix((150, 120, 84), (46, 32, 30), (y - 42) / 7.0), spec=0.9, shine=26, wrap=0.1)
    s.add(beak, [Slab([(cx - 5.5, 41), (cx + 5.5, 41), (cx + 2.5, 48), (cx, 51.5), (cx - 2.5, 48)],
                      depth=4, bevel=2.5, z=13)])
    s.add(Mat((30, 14, 18), wrap=0.0), [Limb(cx - 4, 44.5, cx + 4, 44.5, 0.5, 0.5, 17.5, 17.5)], blend=0.2)

    #  Mouths up the tentacles: bright red lips round a dark hole.
    key = {'k': (0x24, 0x08, 0x10), 'r': (0xe0, 0x2a, 0x3c), 'R': (0xa0, 0x16, 0x28),
           'w': (0xff, 0xf8, 0xe8)}
    for path, r0, r1 in paths:
        N = len(path)
        for i in range(7, N - 8, 12):
            x, y = path[i]
            if s.height_at(x, y) is None:
                continue
            rr = r0 + (r1 - r0) * i / float(N)
            ix, iy = int(round(x)), int(round(y))
            if rr > 3.6:
                s.stamp(ix - 2, iy - 1, [".r.r.", "rkkkr", ".RRR."], key)
            else:
                s.stamp(ix - 1, iy - 1, ["r.r", "rkr", ".R."], key)

    #  Eyes, in clusters: yellow bulbs, each with a bar of pupil.
    eye = Mat((236, 214, 84), spec=1.2, shine=40, wrap=0.1, accent=True)
    cluster = [(cx - 12, 22, 2.2), (cx - 8.5, 26, 1.9), (cx - 14, 27.5, 1.6), (cx - 7.5, 20.5, 1.5),
               (cx + 9, 24, 2.2), (cx + 12.5, 28, 1.8), (cx + 6.5, 28.5, 1.5), (cx + 13, 21.5, 1.5),
               (cx - 1.5, 33, 1.7), (cx + 2.5, 34.5, 1.4)]
    for ex, ey, r in cluster:
        s.add(eye, [Sphere(ex, ey, r, (s.height_at(ex, ey) or 16) - r * 0.4)], blend=0.3)
    for ex, ey, r in cluster:
        w = 3 if r > 1.8 else 2
        s.stamp(int(round(ex - w / 2.0)), int(round(ey - 0.5)), ["k" * w], key)
    return s.render(colours=56, sat=1.05)


# ------------------------------------------------------------------- ralph

def ralph():
    """Ralph: a gerbil, frenzied. A body the size of a fist, bulging eyes,
    and a jaw that opens far wider than anything that size has any business
    opening, full of teeth and froth."""
    import random
    W, H = 52, 43
    s = Scene(W, H, seed=61)
    n = s.noise
    rng = random.Random(3)

    def agouti(x, y):
        g = n.fbm(x * 0.6, y * 0.6, 2)
        tick = n.at(x * 2.6, y * 2.6)
        base = mix((204, 156, 98), (160, 112, 66), (g - 0.4) * 1.5)
        return mix(base, (96, 66, 40), max(0.0, tick - 0.7) * 2.5)

    fur = Mat(agouti, spec=0.1, wrap=0.4, bump=lambda x, y: 0.4 * n.at(x * 2.0, y * 0.9), bump_k=1.2)
    belly = Mat((240, 226, 200), spec=0.1, wrap=0.4, bump=fur.bump, bump_k=1.0)
    pinkm = Mat((236, 164, 168), spec=0.3, wrap=0.3)
    gum = Mat((150, 36, 52), spec=0.6, shine=18, wrap=0.2)
    throat = Mat((52, 10, 20), wrap=0.0)
    tooth = Mat((250, 244, 222), spec=0.8, shine=30, wrap=0.2, accent=True)
    froth = Mat((250, 250, 246), spec=0.6, shine=20, wrap=0.4, accent=True)
    eye = Mat((20, 14, 18), spec=1.6, shine=44, wrap=0.0)

    #  Tail, curling up behind.
    tail, _ = _tentacle([(40, 34), (47, 32), (49, 23), (45, 15), (47, 9)], 2.2, 0.8, 0, 2)
    s.add(fur, tail, blend=0.8)
    s.add(Mat((96, 66, 44), bump=fur.bump), [Ellipsoid(47.2, 8.0, 1.9, 3.0, 1.6, 2.5)], blend=0.5)

    #  Body, hunched, with the long hind feet out in front.
    s.add(fur, [Ellipsoid(34, 30, 11.5, 11, 8, 2)], blend=1)
    s.add(belly, [Ellipsoid(31.5, 32, 7, 8, 5, 6)], blend=1)
    for fx in (28, 42):
        s.add(fur, [Ellipsoid(fx, 39.5, 5.5, 3.0, 3.0, 6)], blend=1)
        s.add(pinkm, [Ellipsoid(fx - 3.5, 41.2, 2.5, 1.3, 1.2, 8)], blend=0.5)

    #  The head, and the jaw hanging open underneath it -- the lower jaw a
    #  furred horseshoe right down to the floor.
    s.add(fur, [Ellipsoid(20, 10.5, 11.5, 9, 7, 10)] +
          [Limb(10, 16, 11, 33, 3.2, 3.0, 11, 12), Limb(30, 16, 29, 33, 3.2, 3.0, 11, 12),
           Ellipsoid(20, 36, 11, 4.2, 3.5, 11)], blend=2.2)
    s.add(throat, [Ellipsoid(20, 25, 8.5, 10, 2.0, 10)], blend=0.5)
    s.add(gum, [Ellipsoid(20, 17.8, 9.0, 2.6, 2.0, 14.5), Ellipsoid(20, 33.2, 8.8, 2.4, 2.0, 13.5)],
          blend=0.8)
    s.add(gum, [Ellipsoid(20, 29.5, 4.2, 3.0, 1.5, 12)], blend=0.5)          # tongue
    #  Round ears.
    s.add(fur, both(40, [Ellipsoid(12, 4.5, 3.6, 3.4, 2.5, 11)]), blend=0.5)
    s.add(pinkm, both(40, [Ellipsoid(12, 4.6, 2.2, 2.0, 1.2, 13.4)]), blend=0.3)
    #  The eyes, bulging right out of the skull.
    s.add(eye, [Sphere(14.5, 9.5, 3.2, 14.5), Sphere(25.5, 9.5, 3.2, 14.5)], blend=0.3)

    #  Teeth, top and bottom, and froth at every edge of it.
    for k in range(7):
        x = 13.5 + k * 2.15
        s.add(tooth, [Limb(x, 18.5, x + 0.1, 21.8 - abs(k - 3) * 0.3, 0.9, 0.2, 16, 16)], blend=0.2)
        s.add(tooth, [Limb(x + 0.5, 32.5, x + 0.4, 29.5 + abs(k - 3) * 0.3, 0.9, 0.2, 15, 15)], blend=0.2)
    #  The incisors, which on a gerbil are the ones that matter.
    s.add(Mat((244, 210, 120), spec=0.8, shine=30, accent=True),
          [Limb(19, 17, 19, 23, 1.1, 0.8, 17, 17), Limb(21, 17, 21, 23, 1.1, 0.8, 17, 17)], blend=0.2)
    for _ in range(26):
        t = rng.uniform(0, 2 * math.pi)
        x = 20 + math.cos(t) * rng.uniform(8.0, 10.5)
        y = 25.5 + math.sin(t) * rng.uniform(8.0, 10.5)
        if 14 < y < 38:
            s.add(froth, [Sphere(x, y, rng.uniform(0.7, 1.4), 15)], blend=0.3)
    #  Drool, stringing to the floor.
    s.add(froth, [Limb(12, 35, 11.5, 40.5, 0.6, 0.4, 15, 14), Limb(27, 35, 27.8, 39, 0.55, 0.35, 15, 14)],
          blend=0.2)
    #  Little hands raised either side.
    s.add(pinkm, [Ellipsoid(7.5, 24, 2.2, 1.8, 1.5, 13), Ellipsoid(33, 24, 2.2, 1.8, 1.5, 13)], blend=0.4)

    key = {'w': (0xff, 0xff, 0xff), 'r': (0xd8, 0x3a, 0x3a)}
    s.stamp(13, 8, ["w"], key)
    s.stamp(24, 8, ["w"], key)
    s.stamp(16, 11, ["r"], key)
    s.stamp(27, 11, ["r"], key)
    return s.render(colours=50, sat=1.05)


# ------------------------------------------------------- heather the bear

def heather():
    """Heather the Bear: an elderly black bear from the circus, on roller
    skates, grey in the muzzle -- and full of parasites, whose worms come
    writhing out of her in tendrils."""
    W, H = 64, 69
    s = Scene(W, H, seed=71)
    n = s.noise
    cx = 32

    def coat(x, y):
        g = n.fbm(x * 0.4, y * 0.4, 3)
        grey = max(0.0, n.fbm(x * 0.18 + 5, y * 0.18, 2) - 0.58) * 2.6     # old age, in patches
        return mix(mix((46, 40, 48), (30, 26, 34), (g - 0.4) * 1.5), (120, 114, 118), grey)

    fur = Mat(coat, spec=0.35, shine=14, wrap=0.35,
              bump=lambda x, y: 0.5 * n.at(x * 1.8, y * 0.8), bump_k=1.3)
    muzzle = Mat((164, 146, 126), spec=0.2, wrap=0.35, bump=fur.bump)
    worm = Mat(lambda x, y: mix((238, 188, 186), (180, 112, 126), n.fbm(x * 0.9, y * 0.9) * 1.6 - 0.5),
               spec=0.9, shine=20, wrap=0.35, bump=lambda x, y: 0.35 * math.sin((x + y) * 2.4), bump_k=1.0)
    worm_mouth = Mat((110, 36, 56), spec=0.8, shine=24)
    boot = Mat((238, 234, 226), spec=0.5, shine=20, wrap=0.3)
    wheel = Mat((214, 60, 92), spec=0.8, shine=26, wrap=0.2, accent=True)
    ruff_w = Mat((240, 236, 226), spec=0.3, wrap=0.4)
    ruff_r = Mat((200, 44, 60), spec=0.4, wrap=0.4)

    #  The worms, out of her back and shoulders, reaching up behind her.
    for pts, r0 in (([(23, 27), (16, 21), (13, 13), (7, 9), (5, 3)], 2.8),
                    ([(40, 26), (47, 19), (49, 11), (56, 7), (58, 2)], 2.8),
                    ([(42, 32), (52, 29), (55, 22), (61, 18)], 2.2)):
        prims, path = _tentacle(pts, r0, 1.2, 0, 3)
        s.add(worm, prims, blend=0.6)
        tx, ty = path[-1]
        s.add(worm_mouth, [Sphere(tx, ty, 1.0, 3.6)], blend=0.2)

    #  Legs, then the skates under them.
    for lx, fx in ((27, 24), (37, 41)):
        s.add(fur, [Limb(lx, 44, fx, 56, 6.0, 4.5, 4, 5)], blend=1)
    for fx in (24, 41):
        s.add(boot, [Ellipsoid(fx, 60, 5.2, 4.2, 3.5, 6), Limb(fx, 57, fx, 60, 3.8, 4.0, 7, 7)], blend=1.5)
        s.add(Mat((70, 64, 70), spec=0.6, shine=24), [Limb(fx - 4.5, 63.8, fx + 4.5, 63.8, 0.9, 0.9, 6, 6)], blend=0.3)
        for wx in (fx - 3.5, fx + 3.5):
            s.add(wheel, [Ellipsoid(wx, 65.5, 1.9, 2.1, 1.5, 8)], blend=0.3)
        s.add(Mat((150, 36, 52), spec=0.5), [Ellipsoid(fx + 5.4, 63.5, 1.3, 1.4, 1.0, 8)], blend=0.3)  # toe stop

    #  The body: an old bear's, broad and soft in the middle.
    s.add(fur, [Ellipsoid(cx, 37, 14, 16, 10, 2), Ellipsoid(cx, 26, 12, 7, 7, 5)], blend=3)

    #  Arms out for balance.
    for a in ([Limb(21, 25, 12, 30, 5.2, 4.2, 7, 8), Limb(12, 30, 7, 36, 4.2, 3.6, 8, 9),
               Ellipsoid(6.5, 37.5, 3.6, 3.2, 2.8, 9)],
              [Limb(43, 25, 52, 29, 5.2, 4.2, 7, 8), Limb(52, 29, 57, 34, 4.2, 3.6, 8, 9),
               Ellipsoid(57.5, 35.5, 3.6, 3.2, 2.8, 9)]):
        s.add(fur, a, blend=1.8)
    claw = Mat((210, 204, 188), spec=0.5, accent=False)
    for x0, y0 in ((4.5, 39.5), (6.5, 40.2), (8.5, 39.8), (55.5, 37.5), (57.5, 38.2), (59.5, 37.8)):
        s.add(claw, [Limb(x0, y0, x0 - 0.2, y0 + 1.5, 0.6, 0.3, 11, 11)], blend=0.2)

    #  The circus ruff round her neck, red and white.
    for k in range(-5, 6):
        x = cx + k * 2.4
        y = 21.5 + 0.08 * (k * 2.4) ** 2 * 0.3
        s.add(ruff_r if k % 2 else ruff_w, [Ellipsoid(x, y, 2.4, 2.6, 2.2, 12 - abs(k) * 0.35)], blend=0.8)

    #  Head: round ears, a grey old muzzle, a black nose.
    s.add(fur, [Ellipsoid(cx, 11.5, 10, 9, 7, 9)] + both(2 * cx, [Sphere(cx - 7.8, 4.0, 3.4, 10)]), blend=1.5)
    s.add(Mat((104, 88, 92)), both(2 * cx, [Sphere(cx - 7.8, 4.1, 1.7, 12.2)]), blend=0.3)
    s.add(muzzle, [Ellipsoid(cx, 15.5, 5.6, 4.6, 5.0, 13), Ellipsoid(cx, 19.0, 4.0, 1.8, 2.0, 14)], blend=1.2)
    s.add(Mat((24, 20, 24), spec=1.2, shine=36), [Ellipsoid(cx, 13.2, 2.4, 1.6, 1.6, 17.6)], blend=0.4)
    #  One of them has got as far as her mouth.
    prims, path = _tentacle([(cx + 2.5, 19.5), (cx + 5.5, 22), (cx + 4.5, 25.5), (cx + 7.5, 27.5)],
                            1.3, 0.7, 16, 15)
    s.add(worm, prims, blend=0.4)

    key = {'k': (0x14, 0x10, 0x14), 'c': (0xc8, 0xd4, 0xdc), 'w': (0xff, 0xff, 0xff),
           'm': (0x3a, 0x22, 0x26)}
    s.stamp(26, 9, ["ck"], key)                    # old, clouded eyes
    s.stamp(36, 9, ["kc"], key)
    s.stamp(29, 18, ["m....m", ".mmmm."], key)
    return s.render(colours=52, sat=1.05)


# ------------------------------------------------------- clammy the clown

def clammy():
    """Clammy the Clown: short and very wide, in a filthy pink and blue gown
    with a white ruffle collar. A human face under red, white and blue
    greasepaint, with pointed teeth in it, and long fingernails."""
    W, H = 74, 62
    s = Scene(W, H, seed=83)
    n = s.noise
    cx = 37

    def gown_col(x, y):
        #  Harlequin diamonds, pink and blue, and the filth over them.
        u, v = (x - cx) / 7.0, (y - 20) / 9.0
        d = (math.floor(u + v) + math.floor(u - v)) % 2
        base = (228, 132, 172) if d else (84, 118, 198)
        dirt = n.fbm(x * 0.3, y * 0.3, 3) + max(0.0, (y - 44) / 30.0)       # worst at the hem
        return mix(base, (92, 74, 56), min(0.85, max(0.0, dirt - 0.40) * 2.4))

    gown = Mat(gown_col, spec=0.25, shine=12, wrap=0.35,
               bump=lambda x, y: 0.8 * math.sin(x * 0.9 + 0.8 * math.sin(y * 0.25)) * min(1.0, max(0.0, (y - 30) / 12)),
               bump_k=1.0)
    ruff = Mat((244, 240, 232), spec=0.3, wrap=0.45)
    paint = Mat((244, 240, 236), spec=0.35, shine=16, wrap=0.35)
    nail = Mat((226, 212, 150), spec=0.7, shine=26, wrap=0.2, accent=True)
    shoe = Mat((196, 40, 48), spec=0.9, shine=26, wrap=0.2)

    #  Shoes, poking out from under the hem.
    s.add(shoe, [Ellipsoid(22, 58.5, 8, 3.4, 3.4, 4), Ellipsoid(52, 58.5, 8, 3.4, 3.4, 4)], blend=1)

    #  The gown: a bell, nearly as wide as it is tall, with folds down it.
    bell = [Slab([(22, 24), (52, 24), (62, 34), (70, 52), (68, 58), (6, 58), (4, 52), (12, 34)],
                 depth=12, bevel=11, z=0)]
    for fx in (-22, -12, -3, 6, 15, 24):
        bell.append(Limb(cx + fx * 0.55, 32, cx + fx, 57, 1.2, 3.2, 9, 9.5))
    s.add(gown, bell, blend=2.2)

    #  Short fat arms, and the hands with the nails on them.
    for arm, hand, sgn in (([Limb(19, 29, 11, 37, 5.0, 4.2, 10, 12)], (9, 40), -1),
                           ([Limb(55, 29, 63, 37, 5.0, 4.2, 10, 12)], (65, 40), 1)):
        s.add(gown, arm, blend=1.2)
        hx, hy = hand
        s.add(paint, [Ellipsoid(hx, hy, 3.6, 3.2, 3.0, 13)], blend=0.8)
        for k in range(4):
            x0 = hx - 2.2 + k * 1.5
            s.add(nail, [Limb(x0, hy + 2, x0 + sgn * 1.2 + (k - 1.5) * 0.5, hy + 8.5, 0.75, 0.25, 15, 14)],
                  blend=0.2)

    #  The ruffle collar: a ring of pleats, wider than his shoulders.
    for k in range(22):
        t = math.pi * (k + 0.5) / 22.0
        x, y = cx - math.cos(t) * 17.5, 22.5 + math.sin(t) * 4.5
        pleat = 1.4 if k % 2 else 0.0
        s.add(ruff, [Ellipsoid(x, y, 2.0, 3.6, 2.6, 11 + 3 * math.sin(t) + pleat)], blend=0.4)
    for k in range(18):
        t = math.pi * (k + 0.5) / 18.0
        x, y = cx - math.cos(t) * 12.5, 21 + math.sin(t) * 3.2
        pleat = 1.2 if k % 2 else 0.0
        s.add(ruff, [Ellipsoid(x, y, 1.9, 3.0, 2.4, 13.5 + 2 * math.sin(t) + pleat)], blend=0.4)

    #  Head: round, human, painted.
    head = s.add(paint, [Ellipsoid(cx, 12, 10, 10.5, 8, 11), Ellipsoid(cx, 19, 7.5, 3, 3, 15)], blend=1.5)
    #  Blue diamonds over the eyes, a red mouth round the teeth.
    s.decal(lambda x, y: abs(x - (cx - 4.5)) / 2.8 + abs(y - 9.5) / 4.2 < 1 or
            abs(x - (cx + 4.5)) / 2.8 + abs(y - 9.5) / 4.2 < 1, (60, 96, 196), part=head)
    s.decal(lambda x, y: ((x - cx) / 8.0) ** 2 + ((y - 17.0) / 3.4) ** 2 < 1, (206, 36, 46), part=head)
    #  Hair, what there is of it: two tufts.
    tuft = Mat((214, 60, 48), spec=0.2, wrap=0.4, bump=lambda x, y: 0.6 * n.at(x * 2.5, y * 2.5), bump_k=2)
    s.add(tuft, [Ellipsoid(cx - 10, 8, 3.5, 4.2, 3, 9), Ellipsoid(cx + 10, 8, 3.5, 4.2, 3, 9)], blend=1)
    s.add(Mat((200, 30, 40), spec=1.2, shine=36, accent=True), [Sphere(cx, 13, 2.4, 17.5)], blend=0.3)

    key = {'k': (0x16, 0x10, 0x14), 'w': (0xff, 0xff, 0xf8), 'm': (0x3a, 0x0c, 0x14)}
    s.stamp(32, 9, ["wk", "kk"], key)
    s.stamp(41, 9, ["kw", "kk"], key)
    #  The grin: pointed teeth top and bottom in a dark mouth.
    s.stamp(31, 16, ["mwmwmwmwmwmw", "mmmmmmmmmmmm", "wmwmwmwmwmwm"], key)
    return s.render(colours=54, sat=1.05)


# --------------------------------------------------------- ringmaster grimaldi

def grimaldi():
    """Ringmaster Grimaldi: the circus's master, once a dwarf, now a hulking
    Pestiferous Vine -- a body of pale green vines that pulse, and roots
    like pythons. What is left of the ringmaster is the hat."""
    import random
    W, H = 96, 78
    s = Scene(W, H, seed=97)
    n = s.noise
    rng = random.Random(21)
    cx = 48

    def vine_col(x, y):
        g = n.fbm(x * 0.5, y * 0.5, 2)
        return mix((180, 212, 146), (126, 164, 104), (g - 0.35) * 1.2)

    tones = [Mat(lambda x, y, d=d: tuple(v * d for v in vine_col(x, y)), spec=0.6, shine=18, wrap=0.3,
                 bump=lambda x, y: 0.2 * n.at(x * 1.6, y * 1.6))
             for d in (1.0, 0.86, 0.94, 0.78, 1.04)]

    def python(x, y):
        #  Blotched like a snake's back.
        b = n.at(x * 0.6, y * 1.2)
        base = mix((176, 160, 104), (132, 118, 76), n.fbm(x * 0.4, y * 0.4))
        return mix(base, (58, 50, 34), min(1.0, max(0.0, b - 0.55) * 4.5))

    vine = Mat(vine_col, spec=0.6, shine=18, wrap=0.35,
               bump=lambda x, y: 0.3 * n.at(x * 1.6, y * 1.6))
    root = Mat(python, spec=0.7, shine=20, wrap=0.3)
    pulse = Mat((214, 250, 72), glow=True, accent=True)
    gap = Mat((46, 64, 40), wrap=0.1)
    hat = Mat((34, 28, 34), spec=0.5, shine=20, wrap=0.2)
    band = Mat((196, 32, 44), spec=0.6, shine=22, wrap=0.2, accent=True)

    def braid(x0, y0, x1, y1, k, r, amp, z0, z1, phase=0.0):
        """`k` vines twisted round the line from one point to another."""
        out = []
        L = math.hypot(x1 - x0, y1 - y0)
        nx, ny = -(y1 - y0) / L, (x1 - x0) / L
        for i in range(k):
            ph = phase + 2 * math.pi * i / k
            pts = []
            for j in range(7):
                t = j / 6.0
                o = amp * math.sin(ph + t * 5.0) * (1 - 0.35 * t)
                pts.append((x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o))
            prims, path = _tentacle(pts, r, r * 0.8, z0 + (1 + math.cos(ph)) * 1.5,
                                    z1 + (1 + math.cos(ph + 5)) * 1.5, steps=10)
            out.append((prims, path))
        return out

    #  Roots, out along the floor either side like snakes, coiling.
    for pts, r0 in (([(cx - 8, 66), (cx - 22, 70), (cx - 34, 66), (cx - 42, 72), (cx - 46, 68)], 4.4),
                    ([(cx + 8, 66), (cx + 22, 71), (cx + 33, 66), (cx + 42, 72), (cx + 46, 67)], 4.4),
                    ([(cx - 3, 68), (cx - 10, 74), (cx - 22, 75)], 3.6),
                    ([(cx + 3, 68), (cx + 12, 74), (cx + 24, 75)], 3.6)):
        prims, _ = _tentacle(pts, r0, 1.4, 4, 6)
        s.add(root, prims, blend=0.8)

    #  The trunk of him: vines braided up from the roots into a hulk's chest.
    for i, (prims, path) in enumerate(braid(cx, 70, cx, 24, 6, 3.3, 10.0, 4, 8)):
        s.add(tones[i % 5], prims, blend=0.9)
    s.add(gap, [Ellipsoid(cx, 40, 16, 28, 6, 0)], blend=1, under=True)
    #  Shoulders and arms, braided too, hanging to knuckles on the floor.
    for side in (-1, 1):
        for i, (prims, path) in enumerate(braid(cx + side * 12, 26, cx + side * 36, 42, 4, 2.8, 4.5, 10, 12,
                                                 phase=side)):
            s.add(tones[(i + 1) % 5], prims, blend=0.9)
        for i, (prims, path) in enumerate(braid(cx + side * 36, 42, cx + side * 40, 62, 4, 2.4, 3.4, 12, 13,
                                                 phase=-side)):
            s.add(tones[(i + 2) % 5], prims, blend=0.9)
        #  Tendril fingers.
        for f in range(4):
            fx = cx + side * (36 + f * 2.2)
            prims, _ = _tentacle([(cx + side * 40, 62), (fx + side * 1.5, 67), (fx + side * 3, 70)], 1.5, 0.5, 13, 12, 6)
            s.add(vine, prims, blend=0.5)
    #  The head: a knot of vines, bowed forward between the shoulders.
    for i, (prims, path) in enumerate(braid(cx - 8, 20, cx + 8, 20, 4, 2.8, 5.0, 11, 11, phase=0.5)):
        s.add(tones[i % 5], prims, blend=0.9)
    s.add(vine, [Ellipsoid(cx, 17, 9, 8, 6, 9)], blend=1.5)
    #  The face in the knot: smoother than the rest, bowed under the hat.
    s.add(Mat(lambda x, y: tuple(v * 0.9 for v in vine_col(x, y)), spec=0.5, shine=16, wrap=0.3),
          [Ellipsoid(cx + 0.5, 16, 7.5, 5.8, 4.0, 13.5), Ellipsoid(cx + 0.5, 19.8, 4.5, 2.5, 2.0, 15)],
          blend=1.5)

    #  Pulsing nodes along the vines.
    placed = 0
    for _ in range(200):
        if placed >= 16:
            break
        x, y = rng.uniform(cx - 38, cx + 38), rng.uniform(27, 64)
        h = s.height_at(x, y)
        if h is not None and s.mat[int(y * s.ss) * s.W + int(x * s.ss)] in tones:
            s.add(pulse, [Sphere(x, y, rng.uniform(1.2, 1.8), h - 0.5)], blend=0.4)
            placed += 1

    #  What is left of the ringmaster: the top hat, and the dwarf's face in
    #  the knot under it.
    s.add(hat, [Ellipsoid(cx + 1, 9.5, 11, 2.4, 2.0, 15), Limb(cx + 1, 8, cx + 1.5, 1.5, 6.2, 6.6, 13, 13, flat=0.7)],
          blend=0.6)
    s.add(band, [Limb(cx - 5.5, 7.2, cx + 7.8, 7.2, 1.1, 1.1, 17.3, 17.3)], blend=0.3)
    key = {'g': (0xff, 0xe8, 0x5a), 'k': (0x14, 0x1a, 0x10), 'm': (0x22, 0x2a, 0x16)}
    s.stamp(42, 13, [".kk.", "kgkk", ".kk."], key)
    s.stamp(50, 13, [".kk.", "kkgk", ".kk."], key)
    s.stamp(44, 18, ["mmmmmmmm", ".m.mm.m."], key)
    return s.render(colours=54, sat=1.05)


# ------------------------------------------------------------ rage elemental

def rage():
    """The Rage Elemental: a towering behemoth of black and purple smoke on
    six legs of obsidian that end in rake claws, the front two long and
    fingered; a horned badger's skull for a head, curved goat horns on it,
    and red fire pouring smoke out of the eye sockets."""
    import random
    W, H = 100, 72
    s = Scene(W, H, seed=101)
    n = s.noise
    rng = random.Random(13)
    cx = 50

    def smoke_col(x, y):
        g = n.fbm(x * 0.22, y * 0.22, 3)
        return mix((92, 58, 124), (26, 20, 34), (g - 0.3) * 1.8)

    smoke = Mat(smoke_col, spec=0.05, wrap=0.6, bump=lambda x, y: 0.8 * n.fbm(x * 0.4, y * 0.4, 2), bump_k=1.5)
    obsidian = Mat((34, 30, 44), spec=1.6, shine=48, wrap=0.0)
    glass = Mat((70, 62, 92), spec=1.8, shine=40, wrap=0.1)
    eyesmoke = Mat(lambda x, y: mix((170, 90, 110), (90, 60, 110), (26 - y) / 14.0), spec=0.05, wrap=0.6,
                   bump=smoke.bump, bump_k=1.0)
    bone = Mat(lambda x, y: mix((232, 222, 196), (176, 162, 136), n.fbm(x * 0.8, y * 0.8) * 1.4 - 0.3),
               spec=0.35, shine=18, wrap=0.3)
    horn = Mat(lambda x, y: mix((150, 132, 104), (96, 80, 64), 0.5 + 0.5 * math.sin((x + y * 0.4) * 2.2)),
               spec=0.4, shine=20, wrap=0.3)
    fire = Mat(lambda x, y: (255, 96, 44), glow=True, accent=True)
    core = Mat(lambda x, y: (255, 216, 120), glow=True, accent=True)

    #  Smoke going up off it, behind everything.
    for _ in range(26):
        x = cx + rng.uniform(-30, 30)
        y = rng.uniform(4, 26)
        r = rng.uniform(3.0, 7.0) * (0.6 + 0.4 * y / 26.0)
        s.add(smoke, [Sphere(x, y, r, -6 + y * 0.2)], blend=2)

    #  Six legs of obsidian, jointed like an insect's, clawed like a rake.
    def leg(pts, r0, r1, z0, z1, claws=3, reach=(0, 1)):
        prims = []
        N = len(pts) - 1
        for i in range(N):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            prims.append(Limb(x0, y0, x1, y1, r0 + (r1 - r0) * i / N, r0 + (r1 - r0) * (i + 1) / N,
                              z0 + (z1 - z0) * i / N, z0 + (z1 - z0) * (i + 1) / N, flat=0.6))
        s.add(obsidian, prims, blend=0.6)
        fx, fy = pts[-1]
        for k in range(claws):
            dx = (k - (claws - 1) / 2.0) * 2.6
            s.add(glass, [Limb(fx + dx * 0.3, fy, fx + dx + reach[0] * 1.5, fy + 1 + reach[1] * 3.6,
                               1.2, 0.3, z1 + 1, z1 + 1.5)], blend=0.3)
    leg([(cx - 22, 34), (cx - 36, 30), (cx - 45, 50), (cx - 47, 66)], 3.4, 2.0, 0, 2)
    leg([(cx + 22, 34), (cx + 36, 30), (cx + 45, 50), (cx + 47, 66)], 3.4, 2.0, 0, 2)
    leg([(cx - 18, 42), (cx - 30, 44), (cx - 34, 58), (cx - 33, 67)], 3.6, 2.2, 4, 6)
    leg([(cx + 18, 42), (cx + 30, 44), (cx + 34, 58), (cx + 33, 67)], 3.6, 2.2, 4, 6)

    #  The body: a hunched mass of smoke that is somehow solid.
    body = [Ellipsoid(cx, 36, 28, 18, 14, 0)]
    for _ in range(30):
        t = rng.uniform(0, 2 * math.pi)
        d = rng.uniform(0.3, 1.0)
        x, y = cx + math.cos(t) * 26 * d, 36 + math.sin(t) * 16 * d
        r = rng.uniform(4.5, 8.0)
        body.append(Sphere(x, y, r, 14 * math.sqrt(max(0.0, 1 - d * d)) - r * 0.3))
    s.add(smoke, body, blend=2.5)

    #  The front two legs: long, reaching, the claws spread like fingers.
    leg([(cx - 12, 46), (cx - 20, 52), (cx - 22, 62), (cx - 19, 69)], 3.8, 2.4, 14, 16, claws=4, reach=(0.4, 0.6))
    leg([(cx + 12, 46), (cx + 20, 52), (cx + 22, 62), (cx + 19, 69)], 3.8, 2.4, 14, 16, claws=4, reach=(-0.4, 0.6))

    #  Goat horns, curling back off the skull.
    for side in (-1, 1):
        pts = [(cx + side * 5, 22), (cx + side * 11, 15), (cx + side * 18, 13), (cx + side * 22, 18),
               (cx + side * 20, 24)]
        prims, _ = _tentacle(pts, 2.8, 0.8, 18, 16, steps=8)
        s.add(horn, prims, blend=0.8)

    #  The skull: a badger's, long in the snout, facing you.
    skull = [Ellipsoid(cx, 26, 8.5, 7.0, 6, 16), Limb(cx, 29, cx, 41, 5.4, 3.4, 18, 20),
             Ellipsoid(cx, 40.5, 4.0, 2.4, 2.4, 20)]
    skull += both(2 * cx, [Ellipsoid(cx - 6.5, 30, 3.4, 3.0, 2.4, 18)])      # cheekbones
    s.add(bone, skull, blend=1.6)
    #  Eye sockets full of fire, and the smoke pouring out of them.
    sockets = both(2 * cx, [Ellipsoid(cx - 4.2, 26.5, 2.8, 2.4, 1.0, 22.5)])
    s.add(Mat((20, 10, 14), wrap=0.0), sockets, blend=0.4)
    s.add(fire, both(2 * cx, [Ellipsoid(cx - 4.2, 26.5, 2.0, 1.7, 1.0, 23.2)]), blend=0.3)
    s.add(core, both(2 * cx, [Ellipsoid(cx - 4.0, 26.6, 0.9, 0.8, 0.6, 24.0)]), blend=0.3)
    for side in (-1, 1):
        prims, _ = _tentacle([(cx + side * 5.5, 25), (cx + side * 9, 21), (cx + side * 8, 16), (cx + side * 11, 11)],
                             1.4, 2.6, 23, 22, steps=6)
        s.add(eyesmoke, prims, blend=1.0)

    key = {'k': (0x14, 0x0c, 0x10), 't': (0xf2, 0xea, 0xd4)}
    s.stamp(48, 33, ["kk.kk"], key)                 # the nasal cavity
    s.stamp(46, 41, ["t.t.t.t.t"], key)             # teeth
    return s.render(colours=54, sat=1.05)


BOSSES = ['juicer', 'hoarder', 'warchief', 'swine', 'krakaren', 'ralph', 'heather', 'clammy', 'grimaldi',
          'rage']


def main(names):
    import importlib
    out = {}
    path = os.path.join(HERE, 'boss_ref.py')
    if os.path.exists(path):
        sys.path.insert(0, HERE)
        out = dict(importlib.import_module('boss_ref').BOSSES)
    for name in names:
        print('painting', name)
        out[name] = globals()[name]()
    lines = ['"""Generated by tools/art/boss_paint.py -- do not edit; repaint instead."""',
             '', 'BOSSES = {']
    for name in BOSSES:
        if name not in out:
            continue
        pal, rows = out[name]
        lines.append('    %r: (%r,\n     [' % (name, pal))
        lines += ['      %r,' % r for r in rows]
        lines.append('     ]),')
    lines.append('}')
    open(path, 'w').write('\n'.join(lines) + '\n')
    print('wrote', path)


if __name__ == '__main__':
    main(sys.argv[1:] or BOSSES)
