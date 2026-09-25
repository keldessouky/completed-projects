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
    c = Cel(outline=OUT, k=k)
    skin = M('skin', 5, 4, 2, 1)
    hair = Mat(R['hair_brown'][3], R['hair_brown'][2], R['hair_brown'][1], R['hair_brown'][0])
    beard = Mat(R['hair_brown'][2], R['hair_brown'][1], R['hair_brown'][0], R['hair_brown'][0])
    jacket = M('cloth_green', 4, 3, 1, 0)
    tee = M('steel', 4, 3, 2, 1)
    boxers = Mat(R['cloth_cream'][4], R['cloth_cream'][4], R['cloth_cream'][2], R['cloth_cream'][1])
    cx = 32

    # legs and feet first: everything above overlaps them
    for x in (27, 37):
        c.paint(c.capsule(x, 55, x, 64, 3.2, 3.0), skin, shade=1)
    c.paint(c.ellipse(26, 66.5, 4.2, 2.4), skin, shade=1)
    c.paint(c.ellipse(38, 66.5, 4.2, 2.4), skin, shade=1)

    # the tee, then the jacket open over it
    c.paint(c.poly([(24, 33), (40, 33), (41, 51), (23, 51)]), tee)
    left = c.poly([(19, 33), (29, 32), (28, 40), (27, 52), (18, 52)])
    c.paint(left, jacket)
    c.paint(c.mirror(left), jacket)
    # boxers: white, a notch between the legs
    c.paint(c.poly([(20, 49), (44, 49), (45, 58), (34, 58), (32, 55), (30, 58), (19, 58)]),
            boxers, shade=1)
    # arms hang in front of the jacket's sides
    c.paint(c.capsule(20, 35, 17, 49, 3.6, 3.2), jacket)
    c.paint(c.capsule(44, 35, 47, 49, 3.6, 3.2), jacket)
    c.paint(c.ellipse(16.5, 52, 3.2, 3.2), skin, shade=1)
    c.paint(c.ellipse(47.5, 52, 3.2, 3.2), skin, shade=1)

    # head: ears, face, beard, hair
    c.paint(c.ellipse(19.5, 21, 2.8, 3.6), skin, shade=1)
    c.paint(c.ellipse(44.5, 21, 2.8, 3.6), skin, shade=1)
    c.paint(c.capsule(cx, 29, cx, 33, 3.5), skin, shade=1)
    c.paint(c.ellipse(cx, 19, 12.5, 12.5), skin, shade=2)
    c.paint(c.poly([(20, 21), (24, 26), (28, 27.5), (36, 27.5), (40, 26), (44, 21), (44, 25),
                    (40, 31), (32, 33), (24, 31), (20, 25)]), beard, shade=1)
    #  Messy, not spiky: a cap of hair with rounded tufts breaking its edge,
    #  and clumps of fringe hanging over the forehead.
    hair_top = c.ellipse(cx, 13, 14.0, 8.6) - c.rect(0, 17, 63, 71)
    for tx, ty, r in ((21, 8.5, 2.8), (26, 5.8, 2.9), (32, 5.0, 3.0), (38, 5.8, 2.9),
                      (43, 8.5, 2.8)):
        hair_top |= c.ellipse(tx, ty, r, r)
    fringe = set()
    for pts in ([(19, 14), (26, 14), (22.5, 21.5)], [(25, 14), (32, 14), (28, 20.5)],
                [(31, 14), (38, 14), (35, 20)], [(37, 14), (45, 14), (42, 19.5)],
                [(18, 12), (21, 13), (19.5, 24)], [(43, 13), (46, 12), (44.5, 24)]):
        fringe |= c.poly(pts)
    #  One part, so the clumps do not draw seams between each other; the
    #  strands are drawn into it afterwards, from the crown out.
    hair_all = c.paint(hair_top | fringe, hair, shade=2)
    for x1, y1 in ((22, 16), (27, 17), (33, 17), (39, 16)):
        n = 12
        for t in range(3, n):
            x, y = c.at(32 + (x1 - 32) * t / n, 8 + (y1 - 8) * t / n)
            if (x, y) in hair_all and (x, y + 1) in hair_all:
                c.put(x, y, R['hair_brown'][1])

    # the face, by hand
    key = {'D': OUT, 'w': R['cloth_cream'][4], 'i': R['hair_brown'][1],
           'b': R['hair_brown'][0], 'n': R['skin'][2], 'm': R['blood'][2],
           'r': R['blood'][3], 'p': R['skin'][3]}
    #  Eyes with a glint up and in; brows a clear pixel above them, or he
    #  scowls.
    pair(c, 24, 16, c.size(["bb.", "...", ".D.", ".D.", ".D."],
                           ["bbb.", "....", ".DD.", ".wD.", ".DD.", ".iD."],
                           ["bbbb.", "bb...", ".....", ".DDD.", ".wwD.", ".wDD.",
                            ".DDD.", ".iiD.", ".DDD."]), key)
    c.stamp(31, 23, c.size(["n"], ["n"], ["nn", ".n"]), key)
    c.stamp(30, 27, c.size(["Dm"], ["DmmD"], ["DmmmD", ".mmm."]), key)
    pair(c, 21, 23, ["p"], key)
    # hearts on the boxers
    for hx, hy in ((22, 51), (29, 50), (36, 51), (41, 54), (24, 55)):
        c.stamp(hx, hy, c.size(["r"], ["r.r", "rrr", ".r."],
                               ["rr.rr", "rrrrr", ".rrr.", "..r.."]), key)
    return c.finish()


# ----------------------------------------------------------------- donut ---

def donut(k=1.0):
    """Princess Donut, sitting up: the round head and the big eyes of a
    partner creature, the crown, and the attitude."""
    c = Cel(outline=(0x33, 0x1c, 0x18), k=k)
    fur = Mat((0xea, 0xab, 0x72), R['copper'][3], R['copper'][2], R['copper'][1])
    cream = Mat(R['sand'][5], R['sand'][5], R['sand'][4], R['sand'][2])
    gold = M('gold', 4, 3, 2, 1)
    purple = M('arcane', 3, 2, 1, 0)
    pink = Mat(R['cloth_red'][4], R['cloth_red'][4], R['cloth_red'][3], R['cloth_red'][2])
    cx = 32

    # the tail, curled up the right side behind her
    tail = c.capsule(42, 64, 51, 58, 3.4) | c.capsule(51, 58, 53, 49, 3.4, 3.0) | \
        c.capsule(53, 49, 50, 42, 3.0, 2.6)
    c.paint(tail, fur, shade=1)
    # sitting body, haunches either side, cream chest
    c.paint(c.ellipse(cx, 55, 14, 13), fur)
    c.paint(c.ellipse(20.5, 61, 6.5, 6.5), fur, shade=1)
    c.paint(c.ellipse(43.5, 61, 6.5, 6.5), fur, shade=1)
    c.paint(c.ellipse(cx, 51, 8.5, 9), cream, shade=1)
    for x in (27, 37):
        c.paint(c.capsule(x, 53, x, 65, 3.4, 3.2), fur, shade=1)
        c.paint(c.ellipse(x, 66.5, 4.0, 2.6), cream, shade=1)
    # collar and pendant
    c.paint(c.poly([(21, 37), (43, 37), (42, 42), (22, 42)]), purple, shade=1)
    c.paint(c.ellipse(cx, 44.5, 2.8, 2.8), gold, shade=1)

    # ears, then the head over their bases
    ear, inner = c.poly([(15, 22), (17, 3), (29, 12)]), c.poly([(18, 17), (19, 8), (25, 13)])
    c.paint(ear, fur, shade=1)
    c.paint(c.mirror(ear), fur, shade=1)
    c.paint(inner, pink, shade=0, hi=0, seam=False)
    c.paint(c.mirror(inner), pink, shade=0, hi=0, seam=False)
    head = c.ellipse(cx, 25, 17, 13.5)
    #  Cheek ruffs: a Persian's face is wider than its skull.
    for pts in ([(16, 26), (12, 31), (18, 33)], [(17, 31), (14, 36), (21, 36)]):
        head |= c.poly(pts) | c.mirror(c.poly(pts))
    c.paint(head, fur, shade=2)
    c.paint(c.ellipse(cx, 31.5, 7.5, 5.2), cream, shade=1, seam=False)

    # the crown, between the ears
    crown = c.rect(24, 8, 40, 11)
    for x0 in (24, 29, 34):
        crown |= c.poly([(x0, 9), (x0 + 3, 1), (x0 + 6.5, 9)])
    c.paint(crown, gold, shade=1)

    key = {'D': (0x22, 0x1c, 0x1a), 'w': (0xf4, 0xf0, 0xe0), 'g': R['grass'][4],
           'G': R['grass'][3], 'P': R['arcane'][3], 'p': R['arcane'][1],
           'n': R['cloth_red'][3], 'm': R['copper'][1], 's': R['copper'][1]}
    for x in (27, 32, 37):                         # jewels on the tips
        c.stamp(x, 2, ["P"], key)
    c.stamp(31, 9, c.size(["P"], ["Pp", "pp"], ["PPp", "Ppp", "ppp"]), key)
    c.stamp(28, 14, c.size(["s.s", "s.s"], ["s.s.s", "s.s.s", "..s.."],
                           ["s..s..s", "s..s..s", "s..s..s", "...s..."]), key)
    #  Eyes: big, round, green, a slit of pupil, a glint up and in.
    pair(c, 19, 20, c.size(
        [".DDD.", "DwDgD", "DgDgD", "DGGGD", ".DDD."],
        [".DDDDD.", "DwwgggD", "DwggDgD", "DgggDgD", "DGggDGD", "DGGGGGD", ".DDDDD."],
        ["..DDDDD..", ".DwwgggD.", "DwwggDDgD", "DwgggDDgD", "DggggDDgD", "DGgggDDGD",
         "DGGggDGGD", ".DGGGGGD.", "..DDDDD.."]), key)
    c.stamp(30, 29, c.size(["nn"], ["nnnn", ".nn."], ["nnnnn", ".nnn.", "..n.."]), key)
    c.stamp(29, 31, c.size(["m..m"], ["m.mm.m", ".m..m."],
                           ["m..m..m", ".mm.mm.", "......."]), key)
    return c.finish()


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
