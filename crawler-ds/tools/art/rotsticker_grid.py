"""The Rot Sticker, drawn rather than computed.

Floor one's nastiest surprise: a small thing that adheres to whatever walks
past and then detonates. So it is drawn to read as two things at once — an
innocuous flat disc stuck to the ground, and a swollen sac that is already
lit from inside. The hazard colouring does most of the work; the silhouette
is deliberately low and wide so it reads as something you step on rather
than something that comes at you.

Fifteen colours, hand-placed, the same method as the rest of the bestiary.
"""

W, H = 72, 72

PALETTE = [
    (20, 14, 12),        # X  outline
    (52, 30, 24),        # 1  hide, deepest
    (92, 50, 34),        # 2  hide, shadow
    (140, 76, 42),       # 3  hide, base
    (186, 112, 56),      # 4  hide, light
    (226, 158, 84),      # 5  hide, rim
    (58, 20, 26),        # 6  the sac, deepest
    (132, 34, 44),       # 7  the sac, base
    (198, 58, 58),       # 8  the sac, hot
    (248, 132, 72),      # 9  the sac, glowing through
    (255, 226, 150),     # 0  the light inside it
    (36, 46, 34),        # w  the rot it sits in
    (74, 92, 60),        # r  the rot, lit
    (14, 10, 14),        # d  the pucker, and the eye
    (238, 232, 206),     # y  warning flecks
]
KEY = "X1234567890wrdy"


def _row(*segs):
    row = ['.'] * W
    for x, s in segs:
        for i, ch in enumerate(s):
            row[x + i] = ch
    return ''.join(row)


def run(*parts):
    return ''.join(ch * n for ch, n in parts)


#  The body is one swollen mass, not a disc with a cap on it. A flat brim with
#  a dome on top is a mushroom no matter how it is shaded, and this is supposed
#  to be a thing that has latched onto the floor and filled up.
CX, CY, RX, RY = 35, 33, 25, 19
LX, LY = CX - 10, CY - 9          # the key light, high and to the left

#  Distance from the key, in whole texels, at which each step of the hide takes
#  over. Hand-picked rather than evenly spaced: the lit band wants to be tight
#  and the shadow wants room, which is what makes a sphere look full.
STEPS = ((7, '5'), (12, '4'), (17, '3'), (23, '2'))


def _shade(x, y):
    dx, dy = x - LX, (y - LY) * 5 // 4
    d2 = dx * dx + dy * dy
    for radius, ch in STEPS:
        if d2 <= radius * radius:
            return ch
    return '1'


def grid():
    r = _row
    g = [['.'] * W for _ in range(H)]

    for y in range(CY - RY, CY + RY + 1):
        dy = (y - CY) * 256 // RY
        w2 = 65536 - dy * dy
        if w2 <= 0:
            continue
        half = RX * _isqrt(w2) // 256
        if half < 1:
            continue
        for x in range(CX - half, CX + half + 1):
            g[y][x] = _shade(x, y)
        g[y][CX - half - 1] = 'X'
        g[y][CX + half + 1] = 'X'

    #  The sac showing through where the hide has gone thin: an off-centre
    #  patch, so the light inside does not read as a second highlight.
    for y in range(CY - 14, CY + 8):
        for x in range(CX - 8, CX + 16):
            dx, dy = (x - (CX + 4)) * 4, (y - (CY - 2)) * 5
            d2 = dx * dx + dy * dy
            if d2 > 44 * 44 or g[y][x] in '.X':
                continue
            g[y][x] = ('0' if d2 < 16 * 16 else '9' if d2 < 27 * 27
                       else '8' if d2 < 36 * 36 else '7')

    #  Fissures, running out of the sac toward the rim. This is the tell that
    #  it is about to go off, so they get the brightest colour in the palette.
    for x0, y0, dx, dy, n in ((CX + 2, CY - 10, -1, -1, 8), (CX + 12, CY - 7, 1, -1, 7),
                              (CX + 12, CY + 5, 1, 1, 7), (CX - 2, CY + 6, -1, 1, 9)):
        x, y = x0, y0
        for i in range(n):
            if 0 <= x < W and 0 <= y < H and g[y][x] not in '.X':
                g[y][x] = '0' if i < 2 else '9' if i < 5 else '8'
            x += dx
            y += dy                       # actually diagonal: a fissure that
            if i % 3 == 2:                # only runs sideways reads as a stripe
                x += dx

    #  Stubby legs, gripping. Three a side, dark, poking out under the mass --
    #  the one thing that says this is an animal and not a growth.
    for i, (lx, ly, lean) in enumerate(((-22, 8, -1), (-14, 14, -1), (-4, 17, 0),
                                        (8, 17, 0), (17, 14, 1), (24, 8, 1))):
        for k in range(6):
            x = CX + lx + lean * k
            y = CY + ly + k
            if 0 <= x < W and 0 <= y < H:
                g[y][x] = 'd' if k > 2 else '1'
                if 0 <= x + 1 < W:
                    g[y][x + 1] = 'd' if k > 3 else '2'

    #  The rot it has been sitting in.
    for y, half in ((CY + RY + 3, 24), (CY + RY + 4, 28), (CY + RY + 5, 22)):
        for x in range(CX - half, CX + half):
            if 0 <= y < H and g[y][x] == '.':
                g[y][x] = 'r' if (x + y) % 3 else 'w'

    return [''.join(row) for row in g]


def _isqrt(v):
    r = 0
    b = 1 << 16
    while b > v:
        b >>= 2
    while b:
        if v >= r + b:
            v -= r + b
            r = (r >> 1) + b
        else:
            r >>= 1
        b >>= 2
    return r


def decorate(grid_rows):
    """Warning flecks on the hide. Three read as damage; seven read as noise."""
    rows = [list(row) for row in grid_rows]
    for x, y in ((16, 30), (54, 40), (24, 45), (46, 20), (30, 24)):
        if rows[y][x] in "234":
            rows[y][x] = 'y'
    return [''.join(r) for r in rows]
