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
from palettes import INK, RAMPS as W
from forge_tools import rgb555

#  Short names for the ramps this file leans on. Every surface in the dungeon
#  is one of these, which is why a wall, the floor it meets and the crate
#  against it read as the same building rather than three unrelated textures.
S = W['stone']          # poured and cast: the tunnels
A = W['stone_ancient']  # older masonry, further down
D = W['wood_dark']      # timber, and the dark side of rusted plate
C = W['copper']         # rust and corroded metal
G = W['gold']           # painted hazard yellow, and lamplight on metal
T = W['steel']          # plate, rail, conduit

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
    dark = t.ink(INK["cool"])
    shadow = t.ink(S[1])
    base = t.ink(S[3])
    lit = t.ink(S[4])
    hot = t.ink(W["snow"][2])
    stain = t.ink(S[0])
    damp = t.ink(S[2])
    paint_d = t.ink(G[0])
    paint_b = t.ink(G[2])
    paint_l = t.ink(G[4])

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
    grout = t.ink(INK["cool"])
    shadow = t.ink(S[1])
    base = t.ink(S[2])
    lit = t.ink(S[3])
    hot = t.ink(S[4])
    grime = t.ink(S[0])

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
    dark = t.ink(INK["ink"])
    deep = t.ink(INK["cool"])
    base = t.ink(S[1])
    lit = t.ink(S[2])
    pipe_d = t.ink(D[0])
    pipe_b = t.ink(D[2])
    pipe_l = t.ink(D[3])

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
    dark = t.ink(INK["brown"])
    shadow = t.ink(D[1])
    base = t.ink(C[1])
    lit = t.ink(C[2])
    hot = t.ink(W["sand"][4])
    rust_d = t.ink(W["blood"][1])
    rust_b = t.ink(W["blood"][2])
    rust_l = t.ink(C[2])

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
    dark = t.ink(INK["brown"])
    shadow = t.ink(D[1])
    base = t.ink(A[2])
    lit = t.ink(A[3])
    hot = t.ink(W["sand"][4])
    rust = t.ink(C[1])

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
    dark = t.ink(INK["brown"])
    deep = t.ink(D[0])
    base = t.ink(D[1])
    lit = t.ink(D[3])
    glow_d = t.ink(G[0])
    glow_b = t.ink(G[2])
    glow_l = t.ink(G[4])

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
    dark = t.ink(INK["ink"])
    shadow = t.ink(W["arcane"][0])
    base = t.ink(W["arcane"][1])
    lit = t.ink(W["arcane"][2])
    hot = t.ink(W["arcane"][3])
    neon_d = t.ink(W["arcane"][1])
    neon_b = t.ink(W["arcane"][3])
    neon_l = t.ink(W["arcane"][4])

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
    grout = t.ink(INK["ink"])
    shadow = t.ink(W["arcane"][0])
    base = t.ink(W["arcane"][1])
    lit = t.ink(W["arcane"][2])
    hot = t.ink(W["arcane"][3])
    neon = t.ink(W["arcane"][2])

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
    dark = t.ink(INK["ink"])
    deep = t.ink(W["arcane"][0])
    base = t.ink(W["arcane"][0])
    lit = t.ink(W["arcane"][1])
    sign_d = t.ink(W["cloth_purple"][1])
    sign_b = t.ink(W["cloth_purple"][3])
    sign_l = t.ink(W["arcane"][4])

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
    dark = t.ink(INK["brown"])
    mortar = t.ink(A[2])
    shadow = t.ink(W["blood"][1])
    base = t.ink(W["blood"][2])
    lit = t.ink(C[2])
    hot = t.ink(C[3])
    soot = t.ink(INK["warm"])
    moss = t.ink(W["grass"][1])

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
    grout = t.ink(INK["brown"])
    shadow = t.ink(A[1])
    base = t.ink(A[2])
    lit = t.ink(A[3])
    hot = t.ink(A[4])
    wet = t.ink(W["stone"][1])

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
    dark = t.ink(INK["brown"])
    deep = t.ink(D[0])
    base = t.ink(D[1])
    lit = t.ink(A[1])
    wood = t.ink(D[1])
    wood_l = t.ink(D[3])
    lamp = t.ink(G[4])

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
    dark = t.ink(INK["green"])
    shadow = t.ink(W["leaves"][0])
    base = t.ink(W["leaves"][2])
    lit = t.ink(W["leaves"][3])
    hot = t.ink(W["leaves"][4])
    sac_d = t.ink(W["holy"][0])
    sac_b = t.ink(W["holy"][1])
    sac_l = t.ink(W["holy"][3])

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
    dark = t.ink(INK["green"])
    shadow = t.ink(W["grass"][0])
    base = t.ink(W["grass"][1])
    lit = t.ink(W["grass"][2])
    hot = t.ink(W["grass"][3])
    slick = t.ink(W["poison"][3])

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
    dark = t.ink(INK["green"])
    deep = t.ink(W["leaves"][0])
    base = t.ink(W["grass"][0])
    lit = t.ink(W["grass"][1])
    sac_d = t.ink(W["holy"][0])
    sac_b = t.ink(G[2])
    sac_l = t.ink(W["holy"][3])

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
