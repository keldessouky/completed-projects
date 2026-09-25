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
