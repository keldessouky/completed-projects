"""Tiling surface textures for the corridor.

The corridor used to be flat fills with a few lines scratched over them, which
read as coloured rectangles no matter how the shading was tuned. These are
proper 32x32 tiling textures, sampled with perspective by src/render/view3d.c.

Same colour discipline as the sprites: each material gets four or five named
steps spread across the whole luma range rather than a cluster of near-identical
greys, because a texture that lives at four different depths needs contrast to
survive being darkened.

The named steps are the drawing. Between them each surface carries a grain of
in-between tones, which is what the colour budget is for: sixteen colours was a
4bpp hardware limit this game does not have, and two speckle tones over a flat
fill reads as dirt flicked at a rectangle rather than as aggregate in concrete
or tooth in stone. The grain is generated from the material's own steps, so it
costs authoring nothing and cannot drift away from the palette it belongs to.
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

    def mix_ink(self, i, j, t):
        """An index for a tone between two of this texture's own colours."""
        a, b = self.pal[i], self.pal[j]
        return self.ink(tuple(int(round(a[k] + (b[k] - a[k]) * t)) for k in range(3)))

    def grain(self, base, dark, lit, seed, n):
        """Fine tonal grain across a fill, in place of two speckle tones.

        Eight densities between the material's own shadow and its own
        highlight, the extremes rarest. A real surface has a distribution, not
        two outliers; at this scale that distribution is the difference between
        stone and a rectangle someone sprinkled on.
        """
        for k, (t, share) in enumerate(((1.00, 9), (0.72, 5), (0.46, 3), (0.24, 2),
                                        (-0.24, 2), (-0.46, 3), (-0.72, 5), (-1.00, 9))):
            idx = self.mix_ink(base, lit if t > 0 else dark, abs(t))
            self.speckle(idx, seed + k * 37 + 1, max(1, n // share))

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
        #  Thirty-two, not sixteen: the renderers read these through an
        #  indexed byte per texel and a per-shade lookup table, neither of
        #  which cares, and the old cap was borrowed from 4bpp sprite hardware
        #  this game never used. Still a cap, because the tables are walked
        #  per pixel and want to stay in the ARM9's four kilobytes of cache.
        assert len(self.pal) <= 32, "texture palette is too big: %d" % len(self.pal)
        return self.c, [rgb555(c) for c in self.pal]


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
    t.grain(base, shadow, lit, 11, 46)

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
    t.grain(base, shadow, lit, 31, 110)
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
    t.grain(base, deep, lit, 61, 80)
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
    t.grain(base, shadow, lit, 71, 70)

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
    t.grain(base, shadow, lit, 83, 100)
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
    t.grain(base, shadow, lit, 97, 30)
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
    t.grain(base, deep, lit, 101, 90)
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
    t.grain(base, shadow, lit, 103, 80)

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
    t.grain(base, shadow, lit, 109, 100)
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
    t.grain(base, deep, lit, 131, 90)
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


# ------------------------------------------------------------- the boroughs ---
# Tenement brick, the second floor's own material: a city block that was hauled
# down here and stacked, still carrying its own soot.

def wall_brick():
    t = Tex()
    dark = t.ink((28, 18, 16))
    mortar = t.ink((92, 84, 74))
    shadow = t.ink((96, 46, 36))
    base = t.ink((146, 74, 56))
    lit = t.ink((186, 108, 80))
    hot = t.ink((222, 152, 116))
    soot = t.ink((54, 44, 44))
    moss = t.ink((72, 92, 58))

    t.fill(base)
    t.grain(base, shadow, lit, 149, 60)
    #  Stretcher bond: 16x8 bricks, every other course offset by half.
    for row, y in enumerate(range(0, TH, 8)):
        t.hline(y, mortar)
        t.hline((y + 1) % TH, dark)
        t.hline((y + 7) % TH, shadow)
        off = 0 if row % 2 == 0 else 8
        for x in range(off, TW + off, 16):
            t.vline(x % TW, mortar, y + 2, y + 7)
            t.vline((x + 1) % TW, hot, y + 2, y + 7)
    #  Soot up one side and something growing out of the mortar on the other.
    for y in range(0, TH):
        t.px(2, y, soot if y % 3 else base)
        t.px(3, y, soot if y % 4 else base)
    for x, y in ((20, 7), (21, 7), (12, 15), (27, 23), (28, 23), (6, 31)):
        t.px(x, y, moss)
    return t.emit()


def floor_brick():
    t = Tex()
    grout = t.ink((26, 20, 18))
    shadow = t.ink((70, 58, 50))
    base = t.ink((112, 96, 82))
    lit = t.ink((148, 130, 112))
    hot = t.ink((184, 166, 146))
    wet = t.ink((60, 62, 58))

    t.fill(base)
    t.grain(base, shadow, lit, 157, 100)
    #  Cobbles: 8x8, offset, each with a lit crown and a dark seat.
    for row, y in enumerate(range(0, TH, 8)):
        off = 0 if row % 2 == 0 else 4
        for x in range(off, TW + off, 8):
            t.box(x % TW, y, 7, 7, base)
            t.hline(y, hot, x % TW, min(TW - 1, (x % TW) + 6))
            t.hline(y + 6, grout, x % TW, min(TW - 1, (x % TW) + 6))
            t.vline(x % TW, grout, y, y + 6)
            t.vline((x + 6) % TW, shadow, y, y + 6)
    t.speckle(wet, 167, 30)
    return t.emit()


def ceil_brick():
    t = Tex()
    dark = t.ink((12, 10, 10))
    deep = t.ink((30, 24, 22))
    base = t.ink((52, 42, 38))
    lit = t.ink((80, 66, 58))
    wood = t.ink((74, 52, 32))
    wood_l = t.ink((116, 86, 54))
    lamp = t.ink((236, 198, 128))

    t.fill(base)
    t.grain(base, deep, lit, 173, 90)
    #  Joists across, and a bare bulb on a flex between two of them.
    for y in range(0, TH, 11):
        t.box(0, y, TW, 4, wood)
        t.hline(y, wood_l)
        t.hline(y + 3, dark)
    t.vline(16, dark, 4, 9)
    t.box(15, 9, 3, 3, lamp)
    t.px(16, 8, lamp)
    return t.emit()


# -------------------------------------------------------------- the hatchery ---
# Not built. Grown, over something that was built, and still warm.

def wall_chitin():
    t = Tex()
    dark = t.ink((16, 22, 18))
    shadow = t.ink((40, 62, 46))
    base = t.ink((70, 104, 74))
    lit = t.ink((104, 146, 100))
    hot = t.ink((146, 190, 132))
    sac_d = t.ink((94, 74, 24))
    sac_b = t.ink((176, 146, 48))
    sac_l = t.ink((232, 214, 118))

    t.fill(base)
    t.grain(base, shadow, lit, 181, 70)
    #  Overlapping plates, laid like scales rather than courses.
    for row, y in enumerate(range(0, TH, 8)):
        off = 0 if row % 2 == 0 else 6
        for x in range(off, TW + off, 12):
            cx = x % TW
            for i in range(12):
                d = abs(i - 6)
                t.px(cx + i, y, dark)
                t.px(cx + i, y + 1, hot if d > 3 else lit)
                for k in range(2, 7 - d // 3):
                    t.px(cx + i, y + k, base if k < 4 else shadow)
    #  Egg sacs, lit from inside, clustered rather than spread.
    for cx, cy in ((8, 12), (22, 26)):
        for dy in range(-3, 4):
            for dx in range(-3, 4):
                if dx * dx + dy * dy > 9:
                    continue
                t.px(cx + dx, cy + dy,
                     sac_l if dx * dx + dy * dy < 2 else sac_b if dx * dx + dy * dy < 6 else sac_d)
    return t.emit()


def floor_chitin():
    t = Tex()
    dark = t.ink((12, 18, 14))
    shadow = t.ink((36, 54, 40))
    base = t.ink((62, 90, 64))
    lit = t.ink((92, 128, 88))
    hot = t.ink((130, 168, 118))
    slick = t.ink((150, 176, 92))

    t.fill(base)
    t.grain(base, shadow, lit, 193, 110)
    #  Membrane: veins running in two directions, nothing straight.
    for i in range(TW):
        t.px(i, (i * 3 // 2) % TH, dark)
        t.px(i, ((i * 3 // 2) + 1) % TH, shadow)
        t.px((i * 5) % TW, i, dark)
    for x, y in ((6, 6), (18, 12), (26, 24), (10, 28)):
        t.px(x, y, hot)
        t.px(x + 1, y, slick)
    return t.emit()


def ceil_chitin():
    t = Tex()
    dark = t.ink((8, 12, 10))
    deep = t.ink((22, 34, 26))
    base = t.ink((38, 56, 42))
    lit = t.ink((58, 84, 60))
    sac_d = t.ink((86, 70, 22))
    sac_b = t.ink((162, 138, 44))
    sac_l = t.ink((226, 208, 112))

    t.fill(base)
    t.grain(base, deep, lit, 199, 90)
    #  Everything up here is hanging.
    for x in range(2, TW, 7):
        n = 4 + (x % 3) * 3
        t.vline(x, deep, 0, n)
        t.px(x, n, dark)
        t.px(x - 1, n - 1, deep)
    for cx, cy in ((10, 8), (24, 14)):
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                if dx * dx + dy * dy > 4:
                    continue
                t.px(cx + dx, cy + dy, sac_l if not (dx or dy) else sac_b if dx * dx + dy * dy < 3 else sac_d)
    return t.emit()


ROSTER = [
    ('tex_wall_a', wall_concrete), ('tex_floor_a', floor_concrete), ('tex_ceil_a', ceil_concrete),
    ('tex_wall_b', wall_steel),    ('tex_floor_b', floor_steel),    ('tex_ceil_b', ceil_steel),
    ('tex_wall_c', wall_stone),    ('tex_floor_c', floor_stone),    ('tex_ceil_c', ceil_stone),
    ('tex_wall_d', wall_brick),    ('tex_floor_d', floor_brick),    ('tex_ceil_d', ceil_brick),
    ('tex_wall_e', wall_chitin),   ('tex_floor_e', floor_chitin),   ('tex_ceil_e', ceil_chitin),
]
