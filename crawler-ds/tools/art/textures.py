"""Tiling surface textures for the corridor.

The corridor used to be flat fills with a few lines scratched over them, which
read as coloured rectangles no matter how the shading was tuned. These are
proper 32x32 tiling textures, sampled with perspective by src/render/view3d.c.

Same colour discipline as the sprites: every texture is at most 16 colours, and
each material gets four or five steps spread across the whole luma range rather
than a cluster of near-identical greys. A texture that lives at four different
depths needs contrast to survive being darkened.
"""

import png
from forge_tools import rgb555

TW = TH = 32


class Tex:
    """A 32x32 canvas that wraps, so anything drawn across an edge continues
    on the far side and the tile still meets itself cleanly."""

    def __init__(self):
        self.c = png.Canvas(TW, TH)
        self.pal = []

    def ink(self, rgb):
        if rgb not in self.pal:
            self.pal.append(rgb)
        return self.pal.index(rgb)

    def px(self, x, y, i):
        self.c.px[(y % TH) * TW + (x % TW)] = i

    def fill(self, i):
        for n in range(TW * TH):
            self.c.px[n] = i

    def hline(self, y, i, x0=0, x1=TW - 1):
        for x in range(x0, x1 + 1):
            self.px(x, y, i)

    def vline(self, x, i, y0=0, y1=TH - 1):
        for y in range(y0, y1 + 1):
            self.px(x, y, i)

    def box(self, x0, y0, w, h, i):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                self.px(x, y, i)

    def speckle(self, i, seed, n):
        """Deterministic grain. Randomness that changes between builds would
        make every regenerated ROM a different diff."""
        h = seed * 2654435761 & 0xFFFFFFFF
        for _ in range(n):
            h = (h * 1103515245 + 12345) & 0x7FFFFFFF
            x = (h >> 7) % TW
            h = (h * 1103515245 + 12345) & 0x7FFFFFFF
            y = (h >> 7) % TH
            self.px(x, y, i)

    def emit(self):
        assert len(self.pal) <= 16, "a texture must fit a 4bpp palette"
        pal = self.pal + [(0, 0, 0)] * (16 - len(self.pal))
        return self.c, [rgb555(c) for c in pal[:16]]


def _course(t, y, mortar, lip, block_h):
    """One masonry course: a dark bed joint with a lit top lip above it. The
    lip is what makes a block read as having a face rather than being a
    rectangle of colour."""
    t.hline(y, mortar)
    t.hline((y + 1) % TH, lip)
    del block_h


# ------------------------------------------------------------- the tunnels ---
# Poured concrete, cast in panels against plywood forms, with the tie holes
# left behind. This is a car park that stopped being a car park.

def wall_concrete():
    t = Tex()
    dark = t.ink((38, 40, 50))
    shadow = t.ink((66, 70, 84))
    base = t.ink((108, 112, 128))
    lit = t.ink((146, 150, 166))
    hot = t.ink((182, 186, 200))
    stain = t.ink((52, 56, 62))
    damp = t.ink((80, 82, 88))
    paint_d = t.ink((104, 76, 12))
    paint_b = t.ink((186, 146, 32))
    paint_l = t.ink((238, 208, 96))

    t.fill(base)
    t.speckle(shadow, 11, 46)
    t.speckle(lit, 23, 46)

    # Panel joints: one vertical every 16px, one horizontal at the tile seam.
    for x in (0, 16):
        t.vline(x, dark)
        t.vline(x + 1, shadow)
        t.vline(x - 1, lit)
    t.hline(0, dark)
    t.hline(1, hot)
    t.hline(TH - 1, shadow)

    # Form-tie holes. Small: at corridor scale one texel is four screen pixels,
    # and a 3x3 socket came out looking like the wall had been shot at.
    for cx, cy in ((8, 6), (24, 6), (8, 26), (24, 26)):
        t.px(cx, cy, dark)
        t.px(cx + 1, cy, shadow)
        t.px(cx, cy - 1, lit)

    # A painted dado, chest height on every wall in the complex, because this
    # was a car park with signage before it was a dungeon.
    t.box(0, 19, TW, 5, paint_d)
    t.hline(19, hot)
    t.hline(24, dark)
    for x in range(0, TW, 8):                   # the hazard chevrons on it
        for i in range(4):
            t.px(x + i, 20 + i, paint_b)
            t.px(x + i + 1, 20 + i, paint_b)
            t.px(x + i + 2, 20 + i, paint_l)
    for x in range(0, TW, 8):                   # weathered through to the grey
        t.px(x + 6, 21, damp)
        t.px(x + 7, 22, damp)

    # A crack, and the damp that always follows one down.
    for i, (x, y) in enumerate(((5, 4), (5, 5), (6, 6), (6, 7), (7, 8), (7, 9),
                                (7, 10), (8, 11), (8, 12), (9, 13))):
        t.px(x, y, dark if i % 3 else shadow)
    for y in range(14, 22):
        t.px(20, y, stain)
        t.px(21, y, damp if y % 2 else stain)
    return t.emit()


def floor_concrete():
    t = Tex()
    grout = t.ink((30, 32, 40))
    shadow = t.ink((62, 64, 76))
    base = t.ink((100, 100, 110))
    lit = t.ink((134, 134, 146))
    hot = t.ink((168, 168, 180))
    grime = t.ink((54, 54, 58))

    t.fill(base)
    t.speckle(shadow, 31, 110)
    t.speckle(lit, 47, 110)
    # 16px screed squares, scored while wet.
    for n in (0, 16):
        t.hline(n, grout)
        t.hline(n + 1, lit)
        t.vline(n, grout)
        t.vline(n + 1, lit)
    t.speckle(grime, 53, 40)
    t.px(12, 12, hot)
    t.px(28, 20, hot)
    return t.emit()


def ceil_concrete():
    t = Tex()
    dark = t.ink((16, 18, 26))
    deep = t.ink((30, 32, 44))
    base = t.ink((48, 50, 62))
    lit = t.ink((72, 74, 90))
    pipe_d = t.ink((40, 34, 30))
    pipe_b = t.ink((84, 70, 56))
    pipe_l = t.ink((124, 104, 78))

    t.fill(base)
    t.speckle(deep, 61, 80)
    t.speckle(lit, 67, 60)
    # A conduit run, lit along its top where the corridor light reaches it.
    t.box(0, 6, TW, 4, pipe_b)
    t.hline(6, pipe_l)
    t.hline(9, pipe_d)
    for x in (4, 20):                       # hanger straps
        t.vline(x, pipe_d, 0, 6)
    # A structural beam, dropping a shadow onto the slab beneath it.
    t.box(0, 22, TW, 5, deep)
    t.hline(22, lit)
    t.hline(27, dark)
    return t.emit()


# ---------------------------------------------------------- goblin workshop ---
# Bolted steel plate over the concrete, and everything down here rusts.

def wall_steel():
    t = Tex()
    dark = t.ink((32, 22, 16))
    shadow = t.ink((74, 52, 36))
    base = t.ink((122, 88, 58))
    lit = t.ink((166, 124, 82))
    hot = t.ink((212, 168, 112))
    rust_d = t.ink((92, 40, 24))
    rust_b = t.ink((146, 68, 34))
    rust_l = t.ink((190, 104, 52))

    t.fill(base)
    t.speckle(shadow, 71, 70)
    t.speckle(lit, 73, 70)

    # Plate seams: 32 wide, 16 tall, each plate proud of the one below it.
    for y in (0, 16):
        t.hline(y, dark)
        t.hline(y + 1, hot)
        t.hline(y - 1, shadow)
    t.vline(0, dark)
    t.vline(1, lit)

    # Rivets around each plate: bright cap, dark underside. They need the full
    # spread to survive being fogged -- a cap one step off the plate vanishes.
    for py in (0, 16):
        for x in range(3, TW, 6):
            t.px(x, py + 3, lit)
            t.px(x + 1, py + 3, hot)
            t.px(x + 2, py + 3, lit)
            t.px(x, py + 4, dark)
            t.px(x + 1, py + 4, shadow)
            t.px(x + 2, py + 4, dark)
            t.px(x + 1, py + 2, hot)

    # Rust bleeding down from the upper seam and pooling at the lower one.
    for x, top, depth in ((6, 5, 9), (7, 5, 6), (19, 5, 11), (20, 5, 7), (27, 21, 8)):
        for y in range(top, top + depth):
            t.px(x, y, rust_b if (x + y) % 3 else rust_d)
        t.px(x, top, rust_l)
    t.speckle(rust_d, 79, 26)
    return t.emit()


def floor_steel():
    t = Tex()
    dark = t.ink((26, 20, 16))
    shadow = t.ink((62, 48, 36))
    base = t.ink((104, 82, 60))
    lit = t.ink((142, 116, 84))
    hot = t.ink((184, 154, 110))
    rust = t.ink((128, 62, 32))

    t.fill(base)
    t.speckle(shadow, 83, 100)
    # Checker plate: raised teardrops, alternating direction.
    for gy in range(0, TH, 8):
        for gx in range(0, TW, 8):
            flip = ((gx // 8) + (gy // 8)) & 1
            for i in range(5):
                x = gx + 2 + (i if not flip else 4 - i)
                y = gy + 2 + i
                t.px(x, y, hot)
                t.px(x, y + 1, lit)
                t.px(x, y + 2, dark)
    t.speckle(rust, 89, 22)
    t.speckle(shadow, 97, 30)
    return t.emit()


def ceil_steel():
    t = Tex()
    dark = t.ink((14, 12, 12))
    deep = t.ink((34, 26, 22))
    base = t.ink((58, 44, 34))
    lit = t.ink((88, 68, 50))
    glow_d = t.ink((120, 74, 18))
    glow_b = t.ink((196, 132, 34))
    glow_l = t.ink((248, 206, 110))

    t.fill(base)
    t.speckle(deep, 101, 90)
    t.box(0, 20, TW, 6, deep)
    t.hline(20, lit)
    t.hline(25, dark)
    # A sodium tube in a cage, which is the only reason anyone can see.
    t.box(6, 10, 20, 4, glow_b)
    t.hline(10, glow_l, 6, 25)
    t.hline(13, glow_d, 6, 25)
    for x in range(8, 26, 4):
        t.vline(x, dark, 9, 14)
    t.box(4, 9, 2, 6, deep)
    t.box(26, 9, 2, 6, deep)
    return t.emit()


# ------------------------------------------------------------- the boroughs ---
# Cut stone, dressed by something that had time, with the show's signage
# bolted straight through it.

def wall_stone():
    t = Tex()
    dark = t.ink((18, 16, 30))
    shadow = t.ink((44, 40, 70))
    base = t.ink((74, 68, 112))
    lit = t.ink((108, 100, 152))
    hot = t.ink((146, 138, 194))
    neon_d = t.ink((96, 24, 132))
    neon_b = t.ink((174, 62, 214))
    neon_l = t.ink((236, 158, 255))

    t.fill(base)
    t.speckle(shadow, 103, 80)
    t.speckle(lit, 107, 80)

    # Ashlar: 8px courses, every other one offset by half a block.
    for row, y in enumerate(range(0, TH, 8)):
        _course(t, y, dark, hot, 8)
        off = 0 if row % 2 == 0 else 8
        for x in range(off, TW + off, 16):
            t.vline(x % TW, shadow, y + 2, y + 7)
            t.vline((x + 1) % TH, lit, y + 2, y + 7)

    # A neon tube, dead centre, with its bloom on the stone around it.
    t.box(0, 18, TW, 2, neon_b)
    t.hline(18, neon_l)
    t.hline(17, neon_d)
    t.hline(20, neon_d)
    for x in range(0, TW, 2):
        t.px(x, 16, neon_d)
        t.px(x + 1, 21, neon_d)
    return t.emit()


def floor_stone():
    t = Tex()
    grout = t.ink((14, 12, 24))
    shadow = t.ink((40, 36, 62))
    base = t.ink((66, 60, 98))
    lit = t.ink((96, 90, 134))
    hot = t.ink((132, 126, 176))
    neon = t.ink((150, 60, 190))

    t.fill(base)
    t.speckle(shadow, 109, 100)
    t.speckle(lit, 113, 90)
    # Diamond-set flags: the grout runs on the diagonal.
    for i in range(TW * 2):
        t.px(i, i, grout)
        t.px(i + 1, i, lit)
        t.px(i, TH - 1 - i, grout)
        t.px(i + 1, TH - 1 - i, lit)
    t.px(8, 8, hot)
    t.px(24, 24, hot)
    t.speckle(neon, 127, 14)
    return t.emit()


def ceil_stone():
    t = Tex()
    dark = t.ink((10, 8, 18))
    deep = t.ink((24, 20, 40))
    base = t.ink((38, 34, 60))
    lit = t.ink((58, 52, 86))
    sign_d = t.ink((110, 26, 70))
    sign_b = t.ink((196, 54, 118))
    sign_l = t.ink((252, 146, 196))

    t.fill(base)
    t.speckle(deep, 131, 90)
    t.speckle(lit, 137, 50)
    # Ribbed vault, and a hanging sign nobody reads any more.
    for x in range(0, TW, 8):
        t.vline(x, deep)
        t.vline(x + 1, lit)
    t.box(8, 12, 16, 7, sign_d)
    t.box(9, 13, 14, 5, sign_b)
    t.hline(13, sign_l, 9, 22)
    t.box(15, 8, 2, 4, deep)
    t.hline(19, dark, 8, 23)
    return t.emit()


ROSTER = [
    ('tex_wall_a', wall_concrete), ('tex_floor_a', floor_concrete), ('tex_ceil_a', ceil_concrete),
    ('tex_wall_b', wall_steel),    ('tex_floor_b', floor_steel),    ('tex_ceil_b', ceil_steel),
    ('tex_wall_c', wall_stone),    ('tex_floor_c', floor_stone),    ('tex_ceil_c', ceil_stone),
]
