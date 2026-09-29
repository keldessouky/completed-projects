"""The spell effects as pixel art: flipbooks drawn in the manner of the handheld RPGs' move animations (32 x 32 cells,
flat palettes of four shades and an outline, ordered dithering, no soft glow). All of it is drawn here from simple
shapes and noise: no sprite is taken from any game.

    python3 tools/fx/fx_atlas.py           writes build/fx_preview.png (4x) to look at
    tools/pack.py calls atlas() and packs textures/fx.qtex: "QTX1", u16 w, u16 h, then RGBA8 rows top to bottom

Rows are effects, columns their eight frames. The order is the game's FxSprite enum (src/game/world.hpp): append only.
The first six loop (projectiles); the rest play once over a particle's life.
"""
import math
import os
import struct
import zlib

CELL = 32
FRAMES = 8

# palettes: outline, dark, mid, light, highlight (sRGB)
PAL = {
    'fire':   [(0x58, 0x10, 0x08), (0xB8, 0x28, 0x08), (0xF0, 0x70, 0x10), (0xF8, 0xC0, 0x28), (0xF8, 0xF8, 0xB0)],
    'ice':    [(0x10, 0x28, 0x60), (0x28, 0x60, 0xB8), (0x58, 0xA8, 0xF0), (0xA8, 0xE0, 0xF8), (0xF8, 0xF8, 0xF8)],
    'spark':  [(0x58, 0x40, 0x00), (0xC8, 0x98, 0x00), (0xF8, 0xD8, 0x10), (0xF8, 0xF8, 0x78), (0xFF, 0xFF, 0xFF)],
    'poison': [(0x10, 0x30, 0x10), (0x20, 0x80, 0x28), (0x48, 0xB8, 0x38), (0x98, 0xE8, 0x60), (0xE0, 0xF8, 0xB8)],
    'shadow': [(0x10, 0x04, 0x20), (0x40, 0x18, 0x70), (0x78, 0x38, 0xB0), (0xB0, 0x70, 0xE0), (0xE8, 0xC8, 0xF8)],
    'stone':  [(0x28, 0x18, 0x10), (0x60, 0x44, 0x30), (0x90, 0x70, 0x50), (0xC0, 0xA0, 0x78), (0xE8, 0xD8, 0xB8)],
    'smoke':  [(0x30, 0x30, 0x38), (0x58, 0x58, 0x60), (0x88, 0x88, 0x90), (0xB8, 0xB8, 0xC0), (0xE0, 0xE0, 0xE8)],
    'star':   [(0x70, 0x50, 0x08), (0xE0, 0xA0, 0x20), (0xF8, 0xD8, 0x50), (0xF8, 0xF8, 0xA8), (0xFF, 0xFF, 0xFF)],
    'blood':  [(0x30, 0x00, 0x00), (0x78, 0x08, 0x10), (0xB8, 0x18, 0x18), (0xE8, 0x48, 0x40), (0xF8, 0x98, 0x88)],
    'water':  [(0x08, 0x28, 0x48), (0x18, 0x60, 0xA8), (0x40, 0xA0, 0xE8), (0x98, 0xD8, 0xF8), (0xF0, 0xFF, 0xFF)],
    'gold':   [(0x60, 0x40, 0x08), (0xC8, 0x90, 0x18), (0xF0, 0xC8, 0x40), (0xF8, 0xF0, 0x98), (0xFF, 0xFF, 0xF0)],
}

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def bayer(x, y):
    return (BAYER[y & 3][x & 3] + 0.5) / 16.0


def shade(v, x, y):
    """A value in 0..1 to one of the four fill shades (1..4), dithered between them."""
    q = v * 4.0 + (bayer(x, y) - 0.5) * 0.9
    return max(1, min(4, int(q) + 1))


def h2(ix, iy, seed):
    n = (ix * 374761393 + iy * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


def noise(x, y, seed=0):
    ix, iy = math.floor(x), math.floor(y)
    fx, fy = x - ix, y - iy
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = h2(ix, iy, seed), h2(ix + 1, iy, seed)
    c, d = h2(ix, iy + 1, seed), h2(ix + 1, iy + 1, seed)
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy


class Cell:
    """One frame: a grid of (palette, shade) or None, with pixel-centre coordinates from the middle (y down)."""

    def __init__(self):
        self.px = [[None] * CELL for _ in range(CELL)]

    def fill(self, fn, pal):
        for j in range(CELL):
            for i in range(CELL):
                x, y = i - 15.5, j - 15.5
                v = fn(x, y, i, j)
                if v is not None and v > 0:
                    self.px[j][i] = (pal, shade(min(v, 1.0), i, j))

    def put(self, i, j, pal, s):
        if 0 <= i < CELL and 0 <= j < CELL:
            self.px[j][i] = (pal, s)

    def line(self, x0, y0, x1, y1, pal, s):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for k in range(n + 1):
            t = k / n
            self.put(int(round(x0 + (x1 - x0) * t + 15.5)), int(round(y0 + (y1 - y0) * t + 15.5)), pal, s)

    def outline(self):
        """The dark rim the sprites of the time all had: every empty pixel beside a filled one."""
        add = []
        for j in range(CELL):
            for i in range(CELL):
                if self.px[j][i] is not None:
                    continue
                for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ii, jj = i + di, j + dj
                    if 0 <= ii < CELL and 0 <= jj < CELL and self.px[jj][ii] is not None and self.px[jj][ii][1] > 0:
                        add.append((i, j, self.px[jj][ii][0]))
                        break
        for i, j, pal in add:
            self.px[j][i] = (pal, 0)

    def dissolve(self, k, seed=0):
        """Drop pixels in Bayer order as k goes 0 -> 1 (the handheld way to fade)."""
        for j in range(CELL):
            for i in range(CELL):
                if self.px[j][i] is not None and bayer(i + seed, j) < k:
                    self.px[j][i] = None

    def rgba(self):
        out = []
        for row in self.px:
            for p in row:
                if p is None:
                    out.append((0, 0, 0, 0))
                else:
                    r, g, b = PAL[p[0]][p[1]]
                    out.append((r, g, b, 255))
        return out


def lit(x, y, r, lx=-0.6, ly=-0.7):
    """Sphere-like shading with the light from the top left: 0..1 inside radius r."""
    d = math.hypot(x, y) / r
    if d >= 1:
        return 0
    z = math.sqrt(max(0.0, 1 - d * d))
    nx, ny = x / r, y / r
    return max(0.0, min(1.0, 0.35 + 0.65 * (-(nx * lx + ny * ly) * 0.8 + z * 0.55)))


# ---- the projectiles (they loop) -------------------------------------------------------------------------------

def fireball(c, t, f):
    ph = t * 8.0
    def fn(x, y, i, j):
        # a round core with tongues of flame licking up and back
        yy = y - 3
        stretch = 1.0 if yy > 0 else 0.5
        d = 1 - math.hypot(x, yy * stretch) / 8.0
        d += 0.38 * (noise(x * 0.32, y * 0.28 + ph, 3) - 0.5) + 0.2 * (noise(x * 0.7, y * 0.6 + ph * 2, 5) - 0.5)
        return d * 1.6 if d > 0.02 else None
    c.fill(fn, 'fire')
    c.outline()


def ice_shard(c, t, f):
    def fn(x, y, i, j):
        e = abs(x) / 5.5 + abs(y + 1) / 11.0
        if e >= 1:
            return None
        v = 0.45 + (0.35 if x < 0 else 0.0) - 0.25 * e + (0.35 if abs(x + 1.5 - (y + 1) * 0.1) < 0.8 and y < 4 else 0)
        return max(0.05, v)
    c.fill(fn, 'ice')
    c.outline()
    # a twinkle travelling round the crystal
    a = t * math.tau
    sx, sy = int(round(math.cos(a) * 9 + 15.5)), int(round(math.sin(a) * 11 + 14.5))
    for d in range(-2, 3):
        c.put(sx + d, sy, 'ice', 4 if abs(d) < 2 else 3)
        c.put(sx, sy + d, 'ice', 4 if abs(d) < 2 else 3)


def zigzag(c, x0, y0, ang, length, seed, pal, s_core):
    x, y = x0, y0
    steps = max(2, int(length / 3.2))
    for k in range(steps):
        a = ang + (h2(k, seed, 11) - 0.5) * 1.6
        nx, ny = x + math.cos(a) * length / steps, y + math.sin(a) * length / steps
        c.line(x, y, nx, ny, pal, s_core)
        x, y = nx, ny


def spark_ball(c, t, f):
    def fn(x, y, i, j):
        d = math.hypot(x, y)
        return (1.0 - d / 6.5) * 1.3 + 0.25 if d < 5.0 else None
    c.fill(fn, 'spark')
    for k in range(3):
        ang = h2(f, k, 21) * math.tau
        zigzag(c, math.cos(ang) * 4, math.sin(ang) * 4, ang, 9 + 4 * h2(f, k, 22), f * 7 + k, 'spark', 3)
    c.outline()


def poison_blob(c, t, f):
    ph = t * math.tau
    def fn(x, y, i, j):
        a = math.atan2(y, x)
        r = 7.5 + 1.2 * math.sin(3 * a + ph) + 0.7 * math.sin(5 * a - 2 * ph)
        d = math.hypot(x, y - 1)
        return lit(x, y - 1, r) + 0.05 if d < r else None
    c.fill(fn, 'poison')
    # two bubbles rising off it
    for k in range(2):
        tt = (t + k * 0.5) % 1.0
        bx, by = (-3 + 6 * k), -8 - tt * 6
        rr = 2.2 - tt * 0.8
        for j in range(CELL):
            for i in range(CELL):
                d = math.hypot(i - 15.5 - bx, j - 15.5 - by)
                if d < rr:
                    c.px[j][i] = ('poison', 4 if d < rr * 0.45 else 2)
    c.outline()


def shadow_orb(c, t, f):
    ph = t * math.tau
    def fn(x, y, i, j):
        d = math.hypot(x, y)
        if d >= 8.5:
            return None
        a = math.atan2(y, x)
        swirl = 0.5 + 0.5 * math.sin(2 * a + d * 0.75 - ph * 2)
        return 0.15 + 0.55 * swirl * (d / 8.5) + 0.3 * (d / 8.5)
    c.fill(fn, 'shadow')
    c.outline()


def stone(c, t, f):
    rot = t * math.tau / 2
    def fn(x, y, i, j):
        a = math.atan2(y, x) - rot
        a = math.floor(a / (math.tau / 7)) * (math.tau / 7)   # a chipped stone of seven faces
        r = 6.5 + 1.6 * (h2(int(round(a * 7 / math.tau)) % 7, 0, 9) - 0.5) * 2
        return lit(x, y, r * 1.05) + 0.05 if math.hypot(x, y) < r else None
    c.fill(fn, 'stone')
    c.outline()


# ---- the one-shots (over a particle's life) -----------------------------------------------------------------------

def ember(c, t, f):
    s = 7.0 * math.sin(math.pi * min(1.0, 0.25 + t * 0.9))
    def fn(x, y, i, j):
        yy = y - 2 - t * 3
        d = 1 - math.hypot(x, yy * (1.0 if yy > 0 else 0.55)) / max(1.0, s)
        d += 0.3 * (noise(x * 0.4, y * 0.35 + t * 6, 7) - 0.5)
        return (d * 1.5 - t * 0.6) if d > 0.05 else None
    c.fill(fn, 'fire')
    c.outline()


def frost(c, t, f):
    s = 10.0 * math.sin(math.pi * min(1.0, 0.2 + t))
    for k in range(6):
        a = k * math.tau / 6 + t * 0.6
        ex, ey = math.cos(a) * s, math.sin(a) * s
        c.line(0, 0, ex, ey, 'ice', 3)
        bx, by = math.cos(a) * s * 0.55, math.sin(a) * s * 0.55
        for side in (-1, 1):
            b = a + side * 0.9
            c.line(bx, by, bx + math.cos(b) * s * 0.3, by + math.sin(b) * s * 0.3, 'ice', 2)
    c.put(15, 15, 'ice', 4); c.put(16, 15, 'ice', 4); c.put(15, 16, 'ice', 4); c.put(16, 16, 'ice', 4)
    c.outline()
    if t > 0.55:
        c.dissolve((t - 0.55) / 0.45, f)


def zap(c, t, f):
    for k in range(2):
        ang = h2(f, k, 31) * math.tau
        zigzag(c, -math.cos(ang) * 12, -math.sin(ang) * 12, ang, 24, f * 13 + k * 5, 'spark', 4 if t < 0.5 else 3)
    c.outline()
    if t > 0.5:
        c.dissolve((t - 0.5) / 0.5, f)


def bubble(c, t, f):
    if t < 0.6:
        r = 4 + 7 * (t / 0.6)
        def fn(x, y, i, j):
            d = math.hypot(x, y)
            if d >= r:
                return None
            if d > r - 1.6:
                return 0.55
            if math.hypot(x + r * 0.4, y + r * 0.4) < r * 0.25:
                return 1.0
            return None
        c.fill(fn, 'poison')
    else:   # it pops into droplets
        k = (t - 0.6) / 0.4
        for n in range(6):
            a = n * math.tau / 6 + 0.3
            dx, dy = math.cos(a) * (10 + 5 * k), math.sin(a) * (10 + 5 * k) + 6 * k * k
            for j in range(-1, 2):
                for i in range(-1, 2):
                    if abs(i) + abs(j) < 2:
                        c.put(int(dx + 15.5) + i, int(dy + 15.5) + j, 'poison', 3)
    c.outline()


def smoke(c, t, f):
    puffs = [(-4, 2, 6), (4, 3, 5.5), (0, -3, 6.5)]
    grow = 0.6 + 0.6 * t
    def fn(x, y, i, j):
        best = None
        for (px, py, r) in puffs:
            d = math.hypot(x - px * grow, y - py * grow + t * 4)
            rr = r * grow
            if d < rr:
                v = lit(x - px * grow, y - py * grow + t * 4, rr) * 0.8 + 0.1
                best = v if best is None else max(best, v)
        return best
    c.fill(fn, 'smoke')
    c.outline()
    if t > 0.35:
        c.dissolve((t - 0.35) / 0.65, f)


def star(c, t, f):
    # the hit: a four-pointed flash that pops out and shrinks back, and a ring after it
    s = 13.0 * (t / 0.25 if t < 0.25 else max(0.0, 1 - (t - 0.25) / 0.6))
    def fn(x, y, i, j):
        if s <= 0.5:
            return None
        e = (abs(x) * abs(y)) ** 0.5 + 0.35 * (abs(x) + abs(y))
        m = s * 0.55
        if e >= m:
            return None
        return 1.0 - e / m * 0.8
    c.fill(fn, 'star')
    if t > 0.35:
        r = 6 + 10 * (t - 0.35) / 0.65
        for k in range(24):
            a = k * math.tau / 24
            c.put(int(round(math.cos(a) * r + 15.5)), int(round(math.sin(a) * r + 15.5)), 'star', 3)
    c.outline()
    if t > 0.7:
        c.dissolve((t - 0.7) / 0.3, f)


def blast(c, t, f):
    if t < 0.3:   # the fireball swells, white at its heart
        r = 3 + 8 * (t / 0.3)
        def fn(x, y, i, j):
            d = math.hypot(x, y)
            if d >= r + 1.5 * (noise(x * 0.4, y * 0.4, 13) - 0.5) * 2:
                return None
            return 1.0 - 0.7 * d / r + 0.15
        c.fill(fn, 'fire')
    else:         # a ring of flame round a heart of smoke that rises and goes
        k = (t - 0.3) / 0.7
        r = 10 + 2 * k
        def fn(x, y, i, j):
            d = math.hypot(x, y + k * 3)
            n = noise(x * 0.35, y * 0.35 + k * 3, 17)
            if d < r * (0.75 - 0.2 * k) + n * 3:
                return lit(x, y + k * 3, r) * 0.8 + 0.1
            return None
        c.fill(fn, 'smoke')
        def ring(x, y, i, j):
            d = math.hypot(x, y)
            w = 2.5 * (1 - k)
            return 0.9 - 0.6 * k if abs(d - r) < w + 1.2 * (noise(x * 0.5, y * 0.5, 19) - 0.3) else None
        if k < 0.7:
            c.fill(ring, 'fire')
    c.outline()
    if t > 0.55:
        c.dissolve((t - 0.55) / 0.45, f)


def droplets(c, t, f, pal, crown):
    for n in range(7):
        a = h2(n, f // 8, 41) * 0 + n * math.tau / 7 + 0.4
        sp = 8 + 6 * h2(n, 0, 43)
        dx = math.cos(a) * sp * (0.3 + t)
        dy = math.sin(a) * sp * (0.3 + t) * 0.8 - 6 * t + 14 * t * t
        size = 2.2 - 1.4 * t
        for j in range(-2, 3):
            for i in range(-2, 3):
                if i * i + j * j <= size * size:
                    c.put(int(round(dx + 15.5)) + i, int(round(dy + 15.5)) + j, pal, 4 if (i, j) == (-1, -1) else 2)
    if crown and t < 0.5:
        r = 4 + 8 * t
        for k in range(20):
            a = k * math.tau / 20
            c.put(int(round(math.cos(a) * r + 15.5)), int(round(math.sin(a) * r * 0.5 + 18.5)), pal, 3)
    c.outline()
    if t > 0.7:
        c.dissolve((t - 0.7) / 0.3, f)


def blood(c, t, f):
    droplets(c, t, f, 'blood', False)


def water(c, t, f):
    droplets(c, t, f, 'water', True)


def shatter(c, t, f):
    for n in range(6):
        a = n * math.tau / 6 + 0.25
        d = 3 + 12 * t
        cx, cy = math.cos(a) * d, math.sin(a) * d + 4 * t * t
        rot = a + t * 5
        s = 3.2
        pts = [(math.cos(rot + k * math.tau / 3) * s, math.sin(rot + k * math.tau / 3) * s) for k in range(3)]
        for j in range(CELL):
            for i in range(CELL):
                x, y = i - 15.5 - cx, j - 15.5 - cy
                inside = True
                for k in range(3):
                    (x0, y0), (x1, y1) = pts[k], pts[(k + 1) % 3]
                    if (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0) < 0:
                        inside = False
                        break
                if inside:
                    c.px[j][i] = ('ice', 4 if x < 0 else 2)
    c.outline()
    if t > 0.6:
        c.dissolve((t - 0.6) / 0.4, f)


def void(c, t, f):
    r = 11 * (1 - 0.6 * t)
    def fn(x, y, i, j):
        d = math.hypot(x, y)
        if d >= r:
            return None
        a = math.atan2(y, x)
        s = math.sin(3 * a - d * 0.6 + t * 9)
        return 0.2 + 0.7 * (1 - d / r) if s > 0.1 else None
    c.fill(fn, 'shadow')
    c.outline()
    if t > 0.6:
        c.dissolve((t - 0.6) / 0.4, f)


def holy(c, t, f):
    # gold twinkles: a large one in the middle, small ones round it, each popping in turn
    for n, (px, py, s0, ph) in enumerate([(0, 0, 8, 0.0), (-8, -6, 4, 0.25), (8, -4, 4, 0.45), (-5, 8, 3.5, 0.6), (7, 7, 3, 0.35)]):
        k = t - ph
        if k < 0 or k > 0.55:
            continue
        s = s0 * math.sin(math.pi * k / 0.55)
        if s < 1:
            continue
        for d in range(-int(s), int(s) + 1):
            sh = 4 if abs(d) < s * 0.35 else (3 if abs(d) < s * 0.7 else 2)
            c.put(int(px + 15.5) + d, int(py + 15.5), 'gold', sh)
            c.put(int(px + 15.5), int(py + 15.5) + d, 'gold', sh)
        if s > 3:
            for d in (-1, 1):
                c.put(int(px + 15.5) + d, int(py + 15.5) + d, 'gold', 3)
                c.put(int(px + 15.5) + d, int(py + 15.5) - d, 'gold', 3)
    c.outline()


# the FxSprite order in src/game/world.hpp: append only
EFFECTS = [
    ('fireball', fireball), ('ice_shard', ice_shard), ('spark_ball', spark_ball), ('poison_blob', poison_blob),
    ('shadow_orb', shadow_orb), ('stone', stone),
    ('ember', ember), ('frost', frost), ('zap', zap), ('bubble', bubble), ('smoke', smoke), ('star', star),
    ('blast', blast), ('blood', blood), ('water', water), ('shatter', shatter), ('void', void), ('holy', holy),
]


def atlas():
    """(width, height, rgba bytes) of the whole sheet."""
    w, h = CELL * FRAMES, CELL * len(EFFECTS)
    px = bytearray(w * h * 4)
    for row, (_, fn) in enumerate(EFFECTS):
        for f in range(FRAMES):
            c = Cell()
            fn(c, f / FRAMES, f)
            for k, (r, g, b, a) in enumerate(c.rgba()):
                x, y = f * CELL + k % CELL, row * CELL + k // CELL
                o = (y * w + x) * 4
                px[o:o + 4] = bytes((r, g, b, a))
    return w, h, bytes(px)


def qtex(w, h, rgba):
    return b'QTX1' + struct.pack('<HH', w, h) + rgba


def write_png(path, w, h, rgba, scale=1, bg=(24, 20, 30)):
    rows = []
    for y in range(h * scale):
        sy = y // scale
        line = bytearray([0])
        for x in range(w * scale):
            o = (sy * w + x // scale) * 4
            r, g, b, a = rgba[o:o + 4]
            if a == 0:
                r, g, b = bg if ((x // (8 * scale)) + (y // (8 * scale))) % 2 else (bg[0] + 10, bg[1] + 10, bg[2] + 10)
            line += bytes((r, g, b))
        rows.append(bytes(line))
    raw = b''.join(rows)
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w * scale, h * scale, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as fh:
        fh.write(png)


if __name__ == '__main__':
    root = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
    w, h, rgba = atlas()
    os.makedirs(os.path.join(root, 'build'), exist_ok=True)
    out = os.path.join(root, 'build', 'fx_preview.png')
    write_png(out, w, h, rgba, 3)
    print('fx atlas %dx%d, %d effects -> %s' % (w, h, len(EFFECTS), out))
