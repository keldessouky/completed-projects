"""The battle cast, cel painted: three heads tall, outlined, lit from the left.

These replace the realistic-proportioned grids on every screen that shows the
party -- the fight, the title, the menus, the level-up. They are drawn to the
same brief as the overworld sprites, at portrait size: the big head that
carries the face, flat tones with a hard shadow edge, and a dark outline round
the silhouette.

Each is drawn once in a 64x72 design space and painted at any scale `k` (see
cel.Cel): the game uses three, so that no screen ever has to shrink or stretch
finished pixels by a fraction. The faces are the exception -- a face is a
handful of hand-placed pixels, so each has a small, a middle and a large
version, picked by `c.size`.
"""

from cel import Cel, Mat
from palettes import RAMPS as R

OUT = (0x26, 0x1d, 0x22)


def M(ramp, hi, base, shade, line):
    return Mat(R[ramp][hi], R[ramp][base], R[ramp][shade], R[ramp][line])


def pair(c, x, y, rows, key, flip=False):
    """A pair of features placed symmetrically: the left at design (x, y),
    the right mirrored across the figure's centre line. `flip` mirrors the
    pattern too; eyes keep their glint on the lamp's side, so they do not."""
    lx, ly = c.at(x, y)
    rx = int(round(64 * c.k)) - lx - len(rows[0])
    c.stamp(lx, ly, rows, key, scaled=False)
    c.stamp(rx, ly, [r[::-1] for r in rows] if flip else rows, key, scaled=False)


# ------------------------------------------------------------------ carl ---

def carl(k=1.0):
    """Carl, squared up: fists raised, feet apart, eyes on whatever is on
    the right of the screen -- which in a fight is the other side.

    Built on the look of the actor the audiobook's narrator says he pitches
    Carl's voice at: a jaw like a cinder block and a chin to match, short
    dark hair combed over with a bit of a quiff, heavy level brows over
    small, unimpressed eyes, a thick neck and a barrel chest. The beard is
    stubble now, because a beard hides the one thing that makes the face."""
    c = Cel(outline=OUT, k=k)
    skin = M('skin', 5, 4, 2, 1)
    stubble = Mat((0xc6, 0x9c, 0x8c), (0xb4, 0x8e, 0x84), (0x9a, 0x78, 0x72), (0x7e, 0x60, 0x5c))
    hair = Mat((0x7a, 0x58, 0x44), (0x52, 0x3a, 0x30), (0x3a, 0x29, 0x25), (0x28, 0x1c, 0x1c))
    jacket = M('cloth_green', 4, 3, 1, 0)
    cuff = M('cloth_green', 4, 4, 2, 0)
    tee = M('steel', 4, 3, 2, 1)
    boxers = Mat(R['cloth_cream'][4], R['cloth_cream'][4], R['cloth_cream'][2], R['cloth_cream'][1])
    cx = 32

    # legs apart, knees soft, bare feet turned out
    c.paint(c.capsule(27, 55, 24, 64, 3.6, 3.2), skin, shade=1)
    c.paint(c.capsule(37, 55, 40, 64, 3.6, 3.2), skin, shade=1)
    c.paint(c.ellipse(22.5, 66.5, 4.8, 2.5), skin, shade=1)
    c.paint(c.ellipse(41.5, 66.5, 4.8, 2.5), skin, shade=1)

    # a barrel chest: the tee, a crew neck, the jacket open over it, lapels
    c.paint(c.poly([(22, 33), (42, 33), (42, 51), (22, 51)]), tee)
    c.paint(c.poly([(27, 33), (37, 33), (35, 36), (29, 36)]), tee, shade=1)
    left = c.poly([(15, 36), (29, 32), (28, 40), (27, 52), (16, 52)])
    c.paint(left, jacket)
    c.paint(c.mirror(left), jacket)
    lapel = c.poly([(23, 33), (29, 32), (27, 40)])
    c.paint(lapel, cuff, shade=1)
    c.paint(c.mirror(lapel), cuff, shade=1)
    # boxers, a notch between the legs
    c.paint(c.poly([(19, 49), (45, 49), (47, 58), (35, 58), (32, 55), (29, 58), (17, 58)]),
            boxers, shade=1)

    # a neck like a post
    c.paint(c.capsule(cx, 29, cx, 34, 5.2), skin, shade=1)
    # ears, set low
    c.paint(c.ellipse(19, 20.5, 2.8, 3.6), skin, shade=1)
    c.paint(c.ellipse(45, 20.5, 2.8, 3.6), skin, shade=1)
    #  The head is a block, not a ball: temples narrower than the jaw, the
    #  jaw squared off, and the chin standing out below it.
    head = c.poly([(22, 7), (42, 7), (45, 12), (45.5, 21), (46, 27), (43, 32), (38, 35),
                   (26, 35), (21, 32), (18, 27), (18.5, 21), (19, 12)])
    c.paint(head, skin, shade=2)
    #  Stubble over the jaw and the upper lip, hugging the square of it.
    jaw = c.poly([(18.5, 24), (22, 26.5), (28, 27), (36, 27), (42, 26.5), (45.5, 24),
                  (46, 27), (43, 32), (38, 35), (26, 35), (21, 32), (18, 27)])
    jaw_px = c.paint(jaw, stubble, shade=1, hi=0, seam=False)
    #  A sparse speckle, so it reads as stubble rather than as a tan line.
    for (x, y) in jaw_px:
        if (x * 3 + y * 5) % 7 == 0 and c.col.get((x, y)) == stubble.base:
            c.put(x, y, stubble.shade)
    #  Hair: short, dark, combed over from a part on the left, a small quiff
    #  lifting at the front right. Tidy -- the opposite of the mop before.
    cap = c.ellipse(cx, 11, 14.2, 7.6) - c.rect(0, 13, 63, 71)
    cap |= c.poly([(18.5, 9), (21, 9), (20.5, 19), (18.5, 17)])        # sideburns
    cap |= c.poly([(43, 9), (45.5, 9), (45.5, 17), (43.5, 19)])
    cap |= c.poly([(24, 13), (46, 11), (45, 14), (30, 14.5)])        # the sweep
    cap |= c.ellipse(38, 4.8, 6.5, 3.2)                               # the quiff
    hair_all = c.paint(cap, hair, shade=1, seam_dirs=((0, 1),))
    #  Sheen along the sweep, and the part.
    x0, x1 = c.at(26, 0)[0], c.at(43, 0)[0]
    for px in range(x0, x1 + 1):
        y = int(round((6.2 - (px / k - 26) * 0.08) * k))
        for dy in range(max(1, int(round(k)))):
            if (px, y + dy) in hair_all:
                c.put(px, y + dy, (0x7a, 0x58, 0x44))
    for y in range(5, 12):
        p = c.at(24.5, y)
        if p in hair_all:
            c.put(p[0], p[1], (0x28, 0x1c, 0x1c))

    #  The guard: the rear fist tucked by the chin, the lead fist up and out
    #  toward the right. Upper arm, then forearm, then the fist over both.
    c.paint(c.capsule(18, 37, 13, 47, 4.2, 3.6), jacket)
    c.paint(c.capsule(13, 47, 22, 43, 3.6, 3.3), jacket)
    c.paint(c.capsule(20, 44, 22, 43, 3.4), cuff, shade=1)
    c.paint(c.ellipse(25.5, 42, 4.0, 3.7), skin, shade=1)
    c.paint(c.capsule(46, 37, 51, 45, 4.2, 3.6), jacket)
    c.paint(c.capsule(51, 45, 48, 37, 3.6, 3.3), jacket)
    c.paint(c.capsule(49, 39, 48.5, 38, 3.4), cuff, shade=1)
    c.paint(c.ellipse(48, 34.5, 4.0, 3.7), skin, shade=1)

    # the face, by hand
    key = {'D': OUT, 'w': R['cloth_cream'][4], 'b': (0x28, 0x1c, 0x1c),
           'n': R['skin'][2], 'N': R['skin'][1], 'm': (0x86, 0x5e, 0x4e),
           'r': R['blood'][3], 'k': R['skin'][2]}
    #  Heavy brows, dead level; small eyes under a lowered lid, looking right.
    #  Nothing surprises him and nothing is going to.
    pair(c, 22.5, 15.5, c.size(["bbb", "...", "DD.", "wD."],
                               ["bbbbb", ".....", ".DDDD", ".wwDD"],
                               ["bbbbbbb", "bbbbbbb", ".......", "..DDDDD", "..wwwDD",
                                "...wDD."]), key)
    # a strong nose, straight down
    c.stamp(31.5, 20, c.size(["n", "N"], ["n", "n", "nN"], ["n.", "n.", "nn", "NN"]), key)
    # a flat mouth, one corner a notch up
    c.stamp(28.5, 28.5, c.size(["DDD"], ["DDDDm", "....D"], ["DDDDDDm", "......D"]), key)
    # the chin's cleft
    c.stamp(31.5, 32.5, c.size(["m"], ["m", "m"], ["m", "m", "m"]), key)
    # knuckles
    for fx, fy in ((23.5, 40), (46, 32.5)):
        c.stamp(fx, fy, c.size(["m"], ["m.m", ".m."], ["m.m.m", ".m.m."]), key)
    # hearts on the boxers
    for hx, hy in ((20, 51), (27.5, 50), (35, 51), (40.5, 54), (22.5, 55)):
        c.stamp(hx, hy, c.size(["r"], ["r.r", "rrr", ".r."],
                               ["rr.rr", "rrrrr", ".rrr.", "..r.."]), key)
    return c.finish()


# ----------------------------------------------------------------- donut ---

def _streaks(c, mask, cols, n, length, seed=1, skip=()):
    """Long fur: short strokes of lighter and darker hair running down and
    out through a mask, so a shaggy coat reads as a coat of hair rather than
    a flat fill. Deterministic, so every build draws the same cat."""
    pts = sorted(mask)
    if not pts:
        return
    for i in range(n):
        h = (i * 2654435761 + seed * 40503) & 0xFFFFFFFF
        x, y = pts[h % len(pts)]
        col = cols[(h >> 8) % len(cols)]
        lean = ((h >> 12) % 3) - 1
        L = max(2, int(round(length * c.k * (0.7 + ((h >> 16) % 4) * 0.15))))
        for t in range(L):
            p = (x + (lean if t >= L // 2 else 0), y + t)
            if p in mask and p not in skip:
                c.put(p[0], p[1], col)


def donut(k=1.0):
    """Princess Donut: a brown tabby Persian, long-haired and shaggy, with
    the flat face and the permanently unimpressed expression of the breed --
    heavy brows, round green eyes, a tiny nose and a mouth turned down --
    under a gold crown, over a studded purple collar with an amethyst the
    size of her nose. A floof, and she knows it."""
    c = Cel(outline=(0x24, 0x17, 0x12), k=k)
    fur = Mat((0xa8, 0x7a, 0x46), (0x72, 0x4e, 0x2e), (0x54, 0x38, 0x22), (0x38, 0x26, 0x18))
    face = Mat((0xc4, 0x98, 0x62), (0xa8, 0x7e, 0x4c), (0x8a, 0x64, 0x3c), (0x62, 0x44, 0x2a))
    gold = Mat((0xf4, 0xd8, 0x70), (0xde, 0xb2, 0x48), (0xae, 0x80, 0x2e), (0x78, 0x54, 0x1c))
    purple = M('arcane', 3, 2, 1, 0)
    gem = Mat((0xd2, 0xa8, 0xe8), (0x9c, 0x6c, 0xc8), (0x70, 0x48, 0x9c), (0x48, 0x2c, 0x6c))
    inner = Mat((0xb0, 0x7a, 0x6c), (0x9a, 0x66, 0x5a), (0x7e, 0x50, 0x46), (0x5c, 0x38, 0x30))
    #  Mostly gold: the long guard hairs catch the light over a dark coat.
    streak = [(0xd8, 0xae, 0x6a), (0xb8, 0x8c, 0x52), (0xb8, 0x8c, 0x52), (0x4a, 0x32, 0x1e)]
    cx = 32

    # the loaf, shaggy all round
    body = c.fluff(cx, 54, 18, 14, n=24, size=2.4, a0=140, a1=400)
    c.paint(body, fur, shade=2)
    _streaks(c, body, streak, 34, 4.0, seed=3)
    # front paws, peeking out
    for x in (25, 36):
        c.paint(c.fluff(x, 66, 4.6, 2.8, n=5, size=1.4, a0=180, a1=360), fur, shade=1)
    # the tail, curled round the front at her right, a plume
    tail = c.capsule(36, 67, 50, 66, 4.4, 5.2) | c.capsule(50, 66, 56, 58, 5.2, 4.6)
    tail |= c.fluff(49, 64, 7, 4.8, n=10, size=2.6, a0=180, a1=420)
    tail_px = c.paint(tail, fur, shade=2)
    _streaks(c, tail_px, streak, 14, 3.0, seed=7)

    # ears: small, tufted, set wide
    ear = c.poly([(15, 19), (17, 8), (26, 14)])
    ear_in = c.poly([(17.5, 16), (18.5, 11), (23, 14.5)])
    for m in (ear, c.mirror(ear)):
        c.paint(m, fur, shade=1)
    for m in (ear_in, c.mirror(ear_in)):
        c.paint(m, inner, shade=0, hi=0, seam=False)
    # the head: wide, and wider still at the cheeks where the ruff stands out
    head = c.fluff(cx, 27, 17.5, 14, n=24, size=2.4, a0=180, a1=540)
    head |= c.fluff(17.5, 32, 6, 5.5, n=6, size=2.6, a0=90, a1=270)
    head |= c.fluff(46.5, 32, 6, 5.5, n=6, size=2.6, a0=-90, a1=90)
    head_px = c.paint(head, fur, shade=2)
    # the lighter mask of the face
    muzzle = c.ellipse(cx, 31, 7.2, 5.4)
    c.paint(muzzle, face, shade=1, hi=0, seam=False)
    _streaks(c, head_px - muzzle, streak, 26, 3.0, seed=11)
    # tabby marks on the forehead, the classic M
    c.stamp(27, 16, c.size(["d...d", ".d.d."], ["d.d.d.d", ".d.d.d.", "..d.d.."],
                           ["d..d..d..d", ".d..d..d..", "..d..d..d.", "...d...d.."]),
            {'d': (0x3e, 0x2a, 0x1c)})

    # the collar: purple, studded, the pendant hanging from it
    collar = c.poly([(19, 41), (45, 41), (44, 45.5), (20, 45.5)])
    c.paint(collar, purple, shade=1)
    for x in (22, 27, 37, 42):
        c.stamp(x, 42.5, c.size(["y"], ["y"], ["yy", "yy"]), {'y': (0xde, 0xb2, 0x48)})
    c.paint(c.ellipse(cx, 49.5, 4.2, 5.2), gold, shade=1)
    c.paint(c.ellipse(cx, 49.5, 2.8, 3.8), gem, shade=1, hi=1)
    c.paint(c.ellipse(cx, 44.5, 2.2, 1.8), gold, shade=1)

    # the crown: five points, the middle one tallest, a gem in the band
    crown = c.rect(23, 9, 41, 12.5)
    for x0, top in ((22.5, 5), (26, 3.5), (29.5, 1.8), (33, 3.5), (36.5, 5)):
        crown |= c.poly([(x0, 10), (x0 + 2.5, top), (x0 + 5, 10)])
    c.paint(crown, gold, shade=1)
    c.paint(c.ellipse(cx, 10.8, 1.9, 1.6), gem, shade=0, hi=1)

    c.finish()
    key = {'D': (0x1c, 0x12, 0x10), 'w': (0xff, 0xfb, 0xe8), 'g': (0x9c, 0xc4, 0x4c),
           'G': (0x6a, 0x94, 0x30), 'n': (0xe0, 0x8a, 0x8a), 'N': (0xb8, 0x62, 0x66),
           'm': (0x3e, 0x2a, 0x1c), 'P': (0x9c, 0x6c, 0xc8)}
    #  Round green eyes under heavy brows sloping down toward the nose -- the
    #  Persian's resting face, which is disapproval.
    pair(c, 18.5, 20, c.size(
        ["D....", ".DDDD", "DgDgD", "DwDGD", ".DDD."],
        ["DD.....", "..DDDDD", "DDDDDDD", "DggDDgD", "DwgDDgD", "DGgggGD", ".DDDDD."],
        ["DDD.......", "..DDD.....", "....DDDDDD", ".DDDDDDDDD", "DDgggDDggD",
         "DwwggDDggD", "DwgggDDgGD", "DGggggggGD", ".DGGGGGGD.", "..DDDDDD.."]),
        key, flip=True)
    c.stamp(30.5, 28.5, c.size(["nn"], ["nnn", ".N."], ["nnnnn", ".nnN.", "..N.."]), key)
    c.stamp(29.5, 31.5, c.size(["m..m", ".mm."], ["..m..", ".m.m.", "m...m"],
                               ["...m...", "..m.m..", ".m...m.", "m.....m"]), key)
    #  Whiskers: two a side, one pixel, from the muzzle out past the ruff.
    wcol = (0xe6, 0xda, 0xc0)
    for side in (-1, 1):
        for y0, y1 in c.size([(31.5, 31.0)], [(30.5, 29.0), (32.5, 33.5)],
                             [(30.5, 29.0), (32.5, 33.5)]):
            x0, x1 = cx + side * 8, cx + side * 17.5
            a0, b0 = c.at(x0, y0)
            a1, b1 = c.at(x1, y1)
            n = max(abs(a1 - a0), 1)
            for t in range(n + 1):
                c.col[(a0 + (a1 - a0) * t // n, round(b0 + (b1 - b0) * t / n))] = wcol
    return c


# -------------------------------------------------------------- mordecai ---

def mordecai(k=1.0):
    """The guide: short, broad, green, four eyes, a grey beard he has had
    for several hundred seasons, and a hat wider than his shoulders."""
    c = Cel(outline=(0x1f, 0x1b, 0x26), k=k)
    skin = Mat((0xb9, 0xc6, 0x8e), (0xa3, 0xb0, 0x7e), (0x7b, 0x8c, 0x5c), (0x57, 0x66, 0x44))
    robe = M('cloth_purple', 3, 2, 1, 0)
    hat = M('cloth_black', 3, 2, 1, 0)
    beard = M('hair_silver', 3, 2, 1, 0)
    gold = M('gold', 4, 3, 2, 1)
    boots = M('cloth_black', 2, 1, 0, 0)
    cx = 32

    for x in (25, 39):
        c.paint(c.ellipse(x, 66.5, 5.2, 2.8), boots, shade=1)
    body = c.poly([(19, 39), (45, 39), (50, 66), (14, 66)])
    c.paint(body, robe)
    c.paint(c.rect(16, 50, 48, 53) & body, gold, shade=1)
    c.paint(c.rect(30, 50, 34, 53), gold, shade=1)
    c.paint(c.capsule(20, 42, 14, 56, 4.8, 4.2), robe)
    c.paint(c.capsule(44, 42, 50, 56, 4.8, 4.2), robe)
    c.paint(c.ellipse(13.5, 58.5, 3.4, 3.2), skin, shade=1)
    c.paint(c.ellipse(50.5, 58.5, 3.4, 3.2), skin, shade=1)

    ear = c.poly([(20, 25), (13, 21), (21, 30)])
    c.paint(ear, skin, shade=1)
    c.paint(c.mirror(ear), skin, shade=1)
    c.paint(c.ellipse(cx, 28, 13, 11.5), skin, shade=2)
    c.paint(c.poly([(20, 30), (25, 34), (39, 34), (44, 30), (43, 38), (36, 45), (32, 48),
                    (28, 45), (21, 38)]), beard, shade=2)
    # the hat: a low round crown over a brim wider than he is
    c.paint(c.ellipse(cx, 12, 11, 8.5) - c.rect(0, 17, 63, 71), hat, shade=2)
    c.paint(c.ellipse(cx, 18, 21, 3.8), hat, shade=1)

    key = {'D': (0x1f, 0x1b, 0x26), 'Y': R['gold'][4], 'n': (0x7b, 0x8c, 0x5c),
           'm': (0x57, 0x66, 0x44)}
    pair(c, 23, 23, c.size(["DD", "YD"], [".DD.", "DYYD", "DYDD", ".DD."],
                           [".DDD.", "DYYYD", "DYYDD", "DYDDD", ".DDD."]), key)
    pair(c, 27, 28, c.size(["Y"], ["DD", "YD"], [".D.", "DYD", "DDD"]), key)
    c.stamp(31, 30, c.size(["n"], ["nn", "mm"], ["nnn", "nmm", "mm."]), key)
    return c.finish()


# ----------------------------------------------------------------- bopca ---

def bopca(k=1.0):
    """A Bopca: small, tawny, ears longer than the rest of it is tall, and a
    red coat it has been issued and has feelings about."""
    c = Cel(outline=(0x2e, 0x20, 0x1a), k=k)
    fur = M('wood', 4, 3, 2, 1)
    coat = Mat(R['blood'][4], R['blood'][3], R['blood'][2], R['blood'][1])
    white = M('cloth_cream', 4, 4, 2, 1)
    gold = M('gold', 4, 3, 2, 1)
    pink = Mat(R['cloth_red'][4], R['cloth_red'][4], R['cloth_red'][3], R['cloth_red'][2])
    cx = 32

    for x in (26, 38):
        c.paint(c.capsule(x, 58, x, 65, 3.0), fur, shade=1)
        c.paint(c.ellipse(x, 66.8, 4.2, 2.4), fur, shade=1)
    coat_m = c.poly([(20, 40), (44, 40), (47, 61), (17, 61)])
    c.paint(coat_m, coat)
    c.paint(c.rect(29, 41, 35, 61) & coat_m, white, shade=1)
    c.paint(c.rect(20, 40, 44, 41) & coat_m, gold, shade=0)
    for y in (46, 51, 56):
        pair(c, 27, y, ["o"], {'o': R['gold'][3]})
    c.paint(c.capsule(21, 43, 16, 55, 4.0, 3.6), coat)
    c.paint(c.capsule(43, 43, 48, 55, 4.0, 3.6), coat)
    c.paint(c.ellipse(15.5, 57.5, 3.2, 3.0), fur, shade=1)
    c.paint(c.ellipse(48.5, 57.5, 3.2, 3.0), fur, shade=1)

    ear = c.poly([(19, 25), (11, 1), (28, 20)])
    inner = c.poly([(19, 20), (14, 6), (24, 18)])
    for m in (ear, c.mirror(ear)):
        c.paint(m, fur, shade=1)
    for m in (inner, c.mirror(inner)):
        c.paint(m, pink, shade=0, hi=0, seam=False)
    c.paint(c.ellipse(cx, 30, 13.5, 11.5), fur, shade=2)
    c.paint(c.ellipse(cx, 35, 6.5, 4.2), white, shade=1, seam=False)

    key = {'D': (0x22, 0x1c, 0x1e), 'w': (0xf6, 0xf2, 0xe4), 'p': R['cloth_red'][4],
           'n': (0x3a, 0x26, 0x22)}
    pair(c, 23, 25, c.size(["DD", "wD", "DD", "DD"],
                           [".DD.", "DDDD", "DwDD", "DDDD", "DDDD", ".DD."],
                           [".DDD.", "DDDDD", "DwwDD", "DwDDD", "DDDDD", "DDDDD", ".DDD."]), key)
    pair(c, 20, 31, c.size(["p"], ["pp"], ["ppp"]), key)
    c.stamp(31, 33, c.size(["n"], ["nn"], ["nnn"]), key)
    c.stamp(30, 35, c.size(["nn"], ["n..n", ".nn."], ["n...n", ".nnn."]), key)
    return c.finish()


CAST = ('carl', 'donut', 'mordecai', 'bopca')
