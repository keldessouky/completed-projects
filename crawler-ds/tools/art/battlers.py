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
    the right of the screen -- which in a fight is the other side. A battler
    standing with its arms by its sides is a figure on a shelf; this is a man
    who has decided to punch something."""
    c = Cel(outline=OUT, k=k)
    skin = M('skin', 5, 4, 2, 1)
    hair = Mat(R['hair_brown'][3], R['hair_brown'][2], R['hair_brown'][1], R['hair_brown'][0])
    beard = Mat(R['hair_brown'][2], R['hair_brown'][1], R['hair_brown'][0], R['hair_brown'][0])
    jacket = M('cloth_green', 4, 3, 1, 0)
    cuff = M('cloth_green', 4, 4, 2, 0)
    tee = M('steel', 4, 3, 2, 1)
    boxers = Mat(R['cloth_cream'][4], R['cloth_cream'][4], R['cloth_cream'][2], R['cloth_cream'][1])
    cx = 32

    # legs apart, knees soft, bare feet turned out
    c.paint(c.capsule(27, 55, 24, 64, 3.4, 3.0), skin, shade=1)
    c.paint(c.capsule(37, 55, 40, 64, 3.4, 3.0), skin, shade=1)
    c.paint(c.ellipse(22.5, 66.5, 4.6, 2.5), skin, shade=1)
    c.paint(c.ellipse(41.5, 66.5, 4.6, 2.5), skin, shade=1)

    # the tee, crew neck, then the jacket open over it with its lapels
    c.paint(c.poly([(24, 32), (40, 32), (41, 51), (23, 51)]), tee)
    c.paint(c.poly([(28, 32), (36, 32), (34, 35), (30, 35)]), tee, shade=1)
    left = c.poly([(18, 34), (29, 31), (28, 40), (27, 52), (17, 52)])
    c.paint(left, jacket)
    c.paint(c.mirror(left), jacket)
    lapel = c.poly([(24, 32), (29, 31), (27, 39)])
    c.paint(lapel, cuff, shade=1)
    c.paint(c.mirror(lapel), cuff, shade=1)
    # boxers, a notch between the legs, a fold on each side
    c.paint(c.poly([(20, 49), (44, 49), (46, 58), (35, 58), (32, 55), (29, 58), (18, 58)]),
            boxers, shade=1)

    # head: ears, face, beard, hair
    c.paint(c.ellipse(19.5, 21, 2.8, 3.6), skin, shade=1)
    c.paint(c.ellipse(44.5, 21, 2.8, 3.6), skin, shade=1)
    c.paint(c.capsule(cx, 29, cx, 33, 3.5), skin, shade=1)
    c.paint(c.ellipse(cx, 19, 12.5, 12.5), skin, shade=2)
    c.paint(c.poly([(20, 21), (24, 26), (28, 27.5), (36, 27.5), (40, 26), (44, 21), (44, 25),
                    (41, 31), (32, 34), (23, 31), (20, 25)]), beard, shade=1)
    #  Hair with a direction: a cap, and three big clumps swept to the right
    #  over the forehead, with one lock kicking up at the crown. The shape is
    #  most of it -- the same count of pixels as a round mop, but it moves.
    cap = c.ellipse(cx - 0.5, 12.5, 13.8, 8.8) - c.rect(19, 12, 45, 71) - c.rect(0, 16, 63, 71)
    cap |= c.poly([(37, 5), (43, 1.5), (42, 8)])            # one cowlick
    fringe = set()
    for pts in ([(18, 10), (27, 9), (28, 12), (23, 17)],
                [(26, 10), (35, 9), (36, 12), (31.5, 16.5)],
                [(34, 10), (45, 9), (46, 13), (42, 16)],
                [(17, 12), (21, 12), (19.5, 23)], [(43, 12), (47, 13), (45.5, 22)]):
        fringe |= c.poly(pts)
    #  A one-pixel shadow: a deeper one swallows a lock two pixels wide.
    hair_all = c.paint(cap | fringe, hair, shade=1, seam_dirs=((0, 1),))
    #  The sheen: a band of light round the crown, the stripe every handheld
    #  sprite puts on hair so it reads as hair and not as a hat.
    hcx, hcy, hrx, hry = cx - 0.5, 12.5, 13.8, 8.8
    for (x, y) in list(hair_all):
        dx = (x / k + 0.5 / k - hcx) / hrx
        dy = (y / k + 0.5 / k - hcy) / hry
        d = dx * dx + dy * dy
        if 0.34 < d < 0.56 and dy < -0.25 and dx < 0.35:
            c.put(x, y, R['hair_brown'][3])
    #  Partings between the clumps.
    for x0, y0, x1, y1 in ((27, 8, 28.5, 12.5), (35, 8, 36.5, 12.5)):
        n = 8
        for t in range(n + 1):
            p = c.at(x0 + (x1 - x0) * t / n, y0 + (y1 - y0) * t / n)
            if p in hair_all:
                c.put(p[0], p[1], R['hair_brown'][0])

    #  The guard: the rear fist tucked by the chin, the lead fist up and out
    #  toward the right. Upper arm, then forearm, then the fist over both.
    c.paint(c.capsule(20, 35, 15, 46, 3.8, 3.4), jacket)
    c.paint(c.capsule(15, 46, 23, 42, 3.4, 3.2), jacket)
    c.paint(c.capsule(21, 43, 23, 42, 3.3), cuff, shade=1)
    c.paint(c.ellipse(26, 41, 3.8, 3.6), skin, shade=1)
    c.paint(c.capsule(44, 35, 50, 44, 3.8, 3.4), jacket)
    c.paint(c.capsule(50, 44, 47, 36, 3.4, 3.2), jacket)
    c.paint(c.capsule(48, 38, 47.5, 37, 3.3), cuff, shade=1)
    c.paint(c.ellipse(47, 33.5, 3.8, 3.6), skin, shade=1)

    # the face, by hand
    key = {'D': OUT, 'w': R['cloth_cream'][4], 'i': R['hair_brown'][1],
           'b': R['hair_brown'][0], 'n': R['skin'][2], 'm': R['skin'][1],
           'r': R['blood'][3], 'p': R['skin'][3], 'k': R['skin'][2],
           'B': R['hair_brown'][3]}
    #  Eyes with whites, the irises to the right: he is looking at the fight,
    #  not at you. Brows down at the middle -- set, not angry.
    pair(c, 23, 17, c.size(["b..", "...", "wD.", "wD."],
                           [".b..", "..bb", "wwDD", "wDwD", ".wDD"],
                           [".bb...", "...bbb", ".wwDD.", "wwDwDD", "wwDDDD",
                            ".wiiD.", "..DD.."]), key, flip=True)
    c.stamp(32, 23, c.size(["n"], ["kn"], ["kkn", ".nn"]), key)
    #  A set mouth, the corner up on one side, sitting in the beard.
    c.stamp(29, 28, c.size(["DD"], ["DDDm", "...D"], ["DDDDm", "....D"]), key)
    # knuckles
    for fx, fy in ((24, 39), (45, 31.5)):
        c.stamp(fx, fy, c.size(["m"], ["m.m", ".m."], ["m.m.m", ".m.m."]), key)
    # hearts on the boxers
    for hx, hy in ((21, 51), (28, 50), (35, 51), (40, 54), (23, 55)):
        c.stamp(hx, hy, c.size(["r"], ["r.r", "rrr", ".r."],
                               ["rr.rr", "rrrrr", ".rrr.", "..r.."]), key)
    return c.finish()


# ----------------------------------------------------------------- donut ---

def donut(k=1.0):
    """Princess Donut: a floof. A Persian is a sphere of fur with a flat
    little face set in it -- a huge cream ruff, ears nearly lost in the fluff,
    a tail like a feather duster, toe beans showing under the loaf -- and a
    crown, because she has one."""
    c = Cel(outline=(0x3d, 0x22, 0x1c), k=k)
    fur = Mat((0xfb, 0xcf, 0x9c), (0xf0, 0xae, 0x74), (0xd4, 0x86, 0x52), (0xa4, 0x5c, 0x38))
    ruff = Mat((0xfd, 0xf3, 0xde), (0xf6, 0xe3, 0xbd), (0xe0, 0xc2, 0x92), (0xb9, 0x94, 0x64))
    gold = M('gold', 4, 3, 2, 1)
    purple = M('arcane', 3, 2, 1, 0)
    pink = Mat((0xf8, 0xb4, 0xac), (0xf0, 0x94, 0x8e), (0xd8, 0x72, 0x70), (0xb0, 0x52, 0x54))
    cx = 32

    # the tail: a plume curling up behind her right side
    tail = c.capsule(40, 63, 54, 58, 5.0, 5.5) | c.capsule(54, 58, 56.5, 46, 5.5, 5.0) | \
        c.capsule(56.5, 46, 51, 37, 5.0, 3.8)
    tail |= c.fluff(55, 52, 5.2, 9, n=9, size=2.2, a0=-80, a1=100)
    c.paint(tail, fur, shade=2)
    # the loaf: round body, fluffed everywhere but where it sits
    c.paint(c.fluff(cx, 53, 17, 13.5, n=16, size=2.4, a0=150, a1=390), fur, shade=2)
    # toe beans peeking out underneath
    for x in (25.5, 38.5):
        c.paint(c.ellipse(x, 66, 4.4, 2.8), ruff, shade=1)
    # the bib: the ruff runs down her chest
    c.paint(c.fluff(cx, 48, 11.5, 10.5, n=11, size=2.2, a0=20, a1=160), ruff, shade=1,
            seam=False)
    # collar, most of it lost in the ruff, and the pendant
    c.paint(c.poly([(24, 40), (40, 40), (39, 43), (25, 43)]), purple, shade=1)
    c.paint(c.ellipse(cx, 45.5, 2.6, 2.6), gold, shade=1)

    # ears: small, far apart, nearly swallowed by the fluff
    ear = c.poly([(15, 18), (17, 7.5), (25, 13)])
    inner = c.poly([(17.5, 15), (18.5, 10), (22.5, 13.5)])
    c.paint(ear, fur, shade=1)
    c.paint(c.mirror(ear), fur, shade=1)
    c.paint(inner, pink, shade=0, hi=0, seam=False)
    c.paint(c.mirror(inner), pink, shade=0, hi=0, seam=False)
    # the head: wide and round, fluffed all round
    c.paint(c.fluff(cx, 25.5, 17.5, 14.5, n=18, size=2.6, a0=190, a1=530), fur, shade=2)
    # the ruff framing the face, and the cream of the muzzle
    c.paint(c.fluff(cx, 33.5, 14.5, 7.5, n=12, size=2.4, a0=-10, a1=190), ruff, shade=1,
            seam=False)
    c.paint(c.ellipse(cx, 31, 6.5, 4.2), ruff, shade=0, seam=False)

    # the crown, perched on top of all that
    crown = c.rect(26, 9, 38, 11)
    for x0 in (26, 30, 34):
        crown |= c.poly([(x0 - 0.2, 10), (x0 + 2, 3.5), (x0 + 4.4, 10)])
    c.paint(crown, gold, shade=1)

    key = {'D': (0x2a, 0x1c, 0x1c), 'w': (0xff, 0xfb, 0xf0), 'g': (0x8c, 0xc0, 0x5a),
           'G': (0x5f, 0x93, 0x3e), 'P': R['arcane'][3], 'p': R['arcane'][1],
           'n': (0xe8, 0x80, 0x88), 'm': (0x9c, 0x5a, 0x48), 'b': (0xf4, 0x9a, 0x92),
           's': (0xd4, 0x86, 0x52), 'h': (0xfb, 0xcf, 0x9c)}
    for x in (28, 32, 36):                         # jewels on the tips
        c.stamp(x, 4, ["P"], key)
    c.stamp(31, 9.5, c.size(["P"], ["Pp"], ["PPp", "ppp"]), key)
    #  Two faint tabby marks, and a highlight on the crown of the head.
    c.stamp(29, 15, c.size(["s.s"], ["s..s", "s..s"], ["s...s", "s...s", "s...s"]), key)
    #  Eyes: big, round, a full dark pupil and two glints -- the partner
    #  creature's eye, all shine and no menace.
    pair(c, 18.5, 20, c.size(
        [".DDD.", "DwgDD", "DgDDD", "DGGGD", ".DDD."],
        ["..DDDD..", ".DwwgDD.", "DwwDDDgD", "DwDDDDgD", "DgDDDwgD", "DGGGGGGD", ".DGGGGD.",
         "..DDDD.."],
        ["...DDDDD...", "..DwwggDD..", ".DwwwDDDgD.", "DwwwDDDDDgD", "DgwDDDDDDgD",
         "DggDDDDDwgD", "DGgDDDDwwGD", "DGGGgggGGGD", ".DGGGGGGGD.", "..DDDDDDD.."]), key)
    pair(c, 18.5, 29.5, c.size(["b"], ["bb"], ["bbb", ".b."]), key)   # blush
    c.stamp(31, 30, c.size(["n"], ["nn"], ["nnn", ".n."]), key)
    c.stamp(29.5, 31.5, c.size(["mm"], ["m.mm.m", ".m..m."],
                               ["m..m..m", ".mm.mm."]), key)
    #  Toe beans.
    for x in (23, 36):
        c.stamp(x, 66.5, c.size(["b"], ["b.b"], ["b.b.b", ".b.b."]), key)
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
