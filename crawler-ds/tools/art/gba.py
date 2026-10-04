"""Backgrounds in the style of the Game Boy Advance Pokemon games.

What that style is, as rules this file keeps:

  * Flat colour, two or three tones to a material, light from the top left.
    No gradients: where a value has to change across a distance it steps, in
    bands, and the seam between two bands is a row of checker dither.
  * Every shape has an edge a step darker than itself, and a highlight a step
    lighter along its top. Nothing is outlined in black.
  * A battle is a strip of scenery across the top of the screen, a flat field
    of ground under it with a few horizontal bands, and terrain pads -- the
    ellipses the combatants stand on -- drawn in the ground's own colours.
  * Colours come from the game's ramps (palettes.py), a little lighter and
    less saturated than the sprites, so the sprites sit in front.

Every scene is drawn here, at 256 x 192, and written to assets/bg as an
indexed PNG of at most 64 colours that the build reads (tools/forge.py); the
dungeon's floor and wall tiles go to assets/tiles. The pads are drawn by the
game (gfx_pad), so they can go under however many foes there are at whatever
size; their colours are here, in PAD_COLOURS.

    python3 tools/art/gba.py            # all of them
    python3 tools/art/gba.py arena_c    # one
"""

import math
import os
import random
import sys

from palettes import RAMPS as R

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
W, H = 256, 192


def lift(c, t):
    """A colour moved toward white by t (0..1): background, not foreground."""
    return tuple(int(v + (255 - v) * t) for v in c)


def mix(a, b, t):
    return tuple(int(a[k] + (b[k] - a[k]) * t) for k in range(3))


class Canvas:
    def __init__(self, w=W, h=H, fill=(0, 0, 0)):
        self.w, self.h = w, h
        self.px = [fill] * (w * h)

    def put(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y * self.w + x] = c

    def get(self, x, y):
        return self.px[y * self.w + x] if 0 <= x < self.w and 0 <= y < self.h else None

    def rect(self, x, y, w, h, c):
        for j in range(max(0, y), min(self.h, y + h)):
            for i in range(max(0, x), min(self.w, x + w)):
                self.px[j * self.w + i] = c

    def hline(self, x0, x1, y, c):
        self.rect(x0, y, x1 - x0 + 1, 1, c)

    def vline(self, x, y0, y1, c):
        self.rect(x, y0, 1, y1 - y0 + 1, c)

    def checker(self, x, y, w, h, c, phase=0):
        """Half the pixels of a rectangle: the seam between two bands."""
        for j in range(max(0, y), min(self.h, y + h)):
            for i in range(max(0, x), min(self.w, x + w)):
                if (i + j + phase) & 1:
                    self.px[j * self.w + i] = c

    def sparse(self, x, y, w, h, c, every=4, phase=0):
        """A quarter (or less) of the pixels: texture, not a seam."""
        for j in range(max(0, y), min(self.h, y + h)):
            for i in range(max(0, x), min(self.w, x + w)):
                if (i + 2 * j + phase) % every == 0 and j % 2 == 0:
                    self.px[j * self.w + i] = c

    def bands(self, y0, y1, colours):
        """Horizontal bands from y0 to y1, one per colour, checker at seams."""
        n = len(colours)
        for k, c in enumerate(colours):
            a = y0 + (y1 - y0) * k // n
            b = y0 + (y1 - y0) * (k + 1) // n
            self.rect(0, a, self.w, b - a, c)
            if k:
                self.checker(0, a, self.w, 1, colours[k - 1])

    def ellipse(self, cx, cy, rx, ry, c):
        for j in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for i in range(int(cx - rx) - 1, int(cx + rx) + 2):
                dx, dy = (i + 0.5 - cx) / rx, (j + 0.5 - cy) / ry
                if dx * dx + dy * dy <= 1.0:
                    self.put(i, j, c)

    def poly(self, pts, c):
        ys = [p[1] for p in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            yc = y + 0.5
            xs = []
            for k in range(len(pts)):
                (x0, y0), (x1, y1) = pts[k], pts[(k + 1) % len(pts)]
                if (y0 <= yc < y1) or (y1 <= yc < y0):
                    xs.append(x0 + (yc - y0) * (x1 - x0) / (y1 - y0))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                self.hline(int(round(a)), int(round(b)) - 1, y, c)

    def block(self, x, y, w, h, face, hi, lo, edge):
        """A lit block: highlight top and left, shade bottom and right, and
        an edge a step darker than the shade."""
        self.rect(x, y, w, h, face)
        self.hline(x, x + w - 1, y, hi)
        self.vline(x, y, y + h - 1, hi)
        self.hline(x + 1, x + w - 1, y + h - 1, lo)
        self.vline(x + w - 1, y + 1, y + h - 1, lo)
        self.hline(x, x + w - 1, y + h, edge)

    def rows(self):
        return [self.px[y * self.w:(y + 1) * self.w] for y in range(self.h)]


def ramp(name, lo=0, hi=None, t=0.0):
    r = R[name][lo:hi]
    return [lift(c, t) for c in r]


def glow(c, cx, cy, r, col):
    """Light thrown on a wall, in two steps: a solid tint near the source and
    a checker of it further out. The GBA never had a gradient to spend."""
    for y in range(int(cy - r), int(cy + r) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            d = math.hypot(x - cx, (y - cy) * 1.15)
            p = c.get(x, y)
            if p is None or d > r:
                continue
            if d < r * 0.55:
                c.put(x, y, mix(p, col, 0.30))
            elif (x + y) & 1:
                c.put(x, y, mix(p, col, 0.22))


#  Spray-paint letters: a 3x5 alphabet blown up into fat bubble capitals.
GLYPHS = {
    'A': (".#.", "#.#", "###", "#.#", "#.#"), 'C': (".##", "#..", "#..", "#..", ".##"),
    'D': ("##.", "#.#", "#.#", "#.#", "##."), 'I': ("###", ".#.", ".#.", ".#.", "###"),
    'K': ("#.#", "#.#", "##.", "#.#", "#.#"), 'L': ("#..", "#..", "#..", "#..", "###"),
    'O': (".#.", "#.#", "#.#", "#.#", ".#."), 'P': ("##.", "#.#", "##.", "#..", "#.."),
    'R': ("##.", "#.#", "##.", "#.#", "#.#"), 'S': (".##", "#..", ".#.", "..#", "##."),
    'T': ("###", ".#.", ".#.", ".#.", ".#."), 'Y': ("#.#", "#.#", ".#.", ".#.", ".#."),
    'N': ("##.", "#.#", "#.#", "#.#", "#.#"), 'E': ("###", "#..", "##.", "#..", "###"),
}


def tag(c, x0, y0, word, col, k=3, slant=3):
    """A tag in bubble letters: a dark rim, the fill, a highlight along the
    top of each stroke, and a drip or two."""
    cells = set()
    for n, ch in enumerate(word):
        for j, row in enumerate(GLYPHS[ch]):
            for i, v in enumerate(row):
                if v == '#':
                    cells.add((n * 4 + i, j))
    fill = set()
    for (i, j) in cells:
        sx = x0 + i * k - (j * k) // slant
        for b in range(k):
            for a in range(k):
                fill.add((sx + a - b // slant, y0 + j * k + b))
    rim = {(x + dx, y + dy) for (x, y) in fill for dx in (-1, 0, 1) for dy in (-1, 0, 1)} - fill
    for p in rim:
        c.put(p[0], p[1], col[0])
    for (x, y) in fill:
        c.put(x, y, col[2] if (x, y + 1) in fill else col[1])
        if (x, y - 1) not in fill:
            c.put(x, y, col[3])
    rng = random.Random(len(word) * 7 + x0)
    bottom = {}
    for (x, y) in fill:
        bottom[x] = max(bottom.get(x, -1), y)
    for x in rng.sample(sorted(bottom), 2):
        y = bottom[x]
        for d in range(rng.randrange(3, 7)):
            c.put(x, y + 1 + d, col[1])
        c.put(x, y + 1 + d, col[0])


# ------------------------------------------------------------------ arenas --
#
#  One per material the floors are built from, in the order view2d.c picks
#  them: poured concrete, a tagged shelter, old stone, tenement brick, and the
#  city at night. Scenery from the top to HORIZON; ground below it, which is
#  where the foes' pads sit (mobs stand at y=72, render.c draw_battle).

HORIZON = 56


def _ground(c, cols, seed=3):
    """The field: flat, with a few bands getting lighter toward the viewer."""
    c.bands(HORIZON, H, cols)
    #  Scuffs: a few short strokes a step darker, the way the GBA fields are
    #  never quite empty.
    rng = random.Random(seed)
    for _ in range(22):
        x = rng.randrange(0, W - 12)
        y = rng.randrange(HORIZON + 6, H - 4)
        n = rng.randrange(3, 9)
        k = min(len(cols) - 1, (y - HORIZON) * len(cols) // (H - HORIZON))
        c.hline(x, x + n, y, mix(cols[k], (0, 0, 0), 0.10))
        c.hline(x + 1, x + n + 1, y + 1, mix(cols[k], (255, 255, 255), 0.18))


def arena_a():
    """Poured concrete: the tutorial floor's corridors. Cast-concrete panels
    with a hazard stripe at the skirting, strip lights, a pipe run."""
    c = Canvas()
    wall = ramp('stone', t=0.22)             # darkest first
    c.rect(0, 0, W, HORIZON, wall[3])
    for x in range(0, W, 64):                 # panels and the joints between
        c.block(x, 9, 63, 30, wall[3], wall[4], wall[2], wall[1])
        for k in range(4):                    # tie holes
            c.put(x + 10 + k * 14, 16, wall[1])
            c.put(x + 10 + k * 14, 32, wall[1])
    c.rect(0, 0, W, 9, wall[1])               # ceiling, the pipe run along it
    c.hline(0, W - 1, 8, wall[0])
    steel = ramp('steel', t=0.1)
    c.rect(0, 2, W, 3, steel[2])
    c.hline(0, W - 1, 2, steel[4])
    c.hline(0, W - 1, 4, steel[0])
    for x in range(0, W, 32):
        c.rect(x + 14, 1, 2, 5, steel[1])     # brackets
    for x in range(20, W, 64):                # strip lights and their spill
        c.rect(x, 6, 24, 2, (250, 250, 236))
        c.checker(x - 2, 9, 28, 2, lift(wall[4], 0.4))
    gold = ramp('gold', t=0.05)               # the hazard stripe
    y = 41
    c.hline(0, W - 1, y - 1, wall[1])
    c.rect(0, y, W, 6, gold[3])
    c.hline(0, W - 1, y, gold[4])
    for x in range(-12, W, 12):
        c.poly([(x, y + 6), (x + 6, y), (x + 12, y), (x + 6, y + 6)], (52, 52, 56))
    c.hline(0, W - 1, y + 6, wall[1])
    c.rect(0, y + 7, W, HORIZON - y - 7, wall[2])
    c.hline(0, W - 1, y + 7, wall[3])
    c.hline(0, W - 1, HORIZON - 1, wall[0])
    _ground(c, [mix(wall[2], wall[3], 0.3), mix(wall[2], wall[3], 0.7),
                mix(wall[3], wall[4], 0.25), mix(wall[3], wall[4], 0.55)])
    for x in range(8, W, 64):                 # the tutorial's lane lines
        c.rect(x, 120, 30, 2, lift(gold[3], 0.15))
        c.hline(x, x + 29, 122, mix(gold[3], wall[3], 0.6))
    return c


def arena_b():
    """A tagged shelter: board walls under a low roof, spray paint on the
    planks, leaf litter underfoot."""
    c = Canvas()
    wood = ramp('wood', t=0.12)
    dark = ramp('wood_dark', t=0.1)
    for x in range(0, W, 12):                 # vertical boards
        c.rect(x, 0, 12, HORIZON, wood[2] if (x // 12) % 3 else wood[3])
        c.vline(x, 0, HORIZON - 1, dark[1])
        c.vline(x + 1, 0, HORIZON - 1, wood[4])
        c.put(x + 5, 11, dark[1])
        c.put(x + 5, HORIZON - 10, dark[1])
    c.rect(0, 0, W, 7, dark[1])               # the roof beam
    c.hline(0, W - 1, 6, dark[0])
    c.hline(0, W - 1, 0, dark[3])
    paints = [ramp('cloth_blue', 1, None, 0.1), ramp('cloth_red', 1, None, 0.1),
              ramp('poison', 0, 4, 0.0), ramp('arcane', 0, 4, 0.1), ramp('gold', 1, None, 0.0)]
    for (x, y, word, p) in ((8, 13, 'DCC', 1), (70, 20, 'LOL', 0), (128, 11, 'RIP', 4),
                            (186, 18, 'KOS', 3), (232, 12, 'YO', 2)):
        tag(c, x, y, word, paints[p])
    c.rect(0, HORIZON - 5, W, 5, dark[1])
    c.hline(0, W - 1, HORIZON - 5, dark[2])
    c.hline(0, W - 1, HORIZON - 1, dark[0])
    dirt = ramp('sand', t=0.0)
    _ground(c, [mix(dirt[1], dark[2], 0.35), mix(dirt[1], dirt[2], 0.2),
                mix(dirt[1], dirt[2], 0.6), dirt[2]], seed=5)
    rng = random.Random(9)
    leaves = ramp('leaves', t=0.05)
    for _ in range(70):                       # leaf litter, two pixels a leaf
        x, y = rng.randrange(0, W), rng.randrange(HORIZON + 4, H)
        col = rng.choice((leaves[2], leaves[3], R['copper'][3], R['gold'][2]))
        c.put(x, y, col)
        c.put(x + 1, y, mix(col, (0, 0, 0), 0.2))
    return c


def arena_c():
    """Old stone: a dungeon of cut blocks, lit by torches in brackets."""
    c = Canvas()
    st = ramp('stone_ancient', t=0.08)
    c.rect(0, 0, W, HORIZON, st[1])
    rng = random.Random(4)
    y, row = 0, 0
    while y < HORIZON - 5:                    # courses of blocks, staggered
        h = 12 if row % 2 else 10
        x = -((row * 17) % 30)
        while x < W:
            w = rng.randrange(24, 38)
            face = st[2] if rng.random() < 0.7 else st[3]
            c.block(x + 1, y + 1, w - 2, h - 2, face, st[4] if face == st[3] else st[3], st[1], st[0])
            if rng.random() < 0.3:            # a crack
                cx = x + rng.randrange(6, w - 6)
                c.vline(cx, y + 3, y + h - 4, st[1])
                c.put(cx + 1, y + h - 4, st[1])
            x += w
        y += h
        row += 1
    c.rect(0, HORIZON - 5, W, 5, st[1])
    c.hline(0, W - 1, HORIZON - 5, st[3])
    c.hline(0, W - 1, HORIZON - 1, st[0])
    fire = R['fire']                          # torches, and the wall lit round them
    iron = ramp('steel')
    for tx in (44, 212):
        glow(c, tx, 20, 26, fire[5])
        c.rect(tx - 2, 24, 4, 12, iron[1])
        c.vline(tx - 2, 24, 35, iron[3])
        c.hline(tx - 4, tx + 3, 24, iron[3])
        c.hline(tx - 4, tx + 3, 25, iron[0])
        c.ellipse(tx, 17, 4.5, 7.5, fire[2])
        c.ellipse(tx, 19, 3.2, 5, fire[4])
        c.ellipse(tx, 20, 1.6, 3, fire[6])
    floor = ramp('stone', t=0.08)
    _ground(c, [floor[1], mix(floor[1], floor[2], 0.6), mix(floor[2], floor[3], 0.4), floor[3]], seed=7)
    for k, y in enumerate(range(HORIZON + 8, H, 18)):     # flagstone joints
        c.hline(0, W - 1, y, mix(floor[1], (0, 0, 0), 0.15))
        c.hline(0, W - 1, y + 1, mix(floor[3], (255, 255, 255), 0.1))
        for x in range((k * 23) % 44, W, 44):
            c.vline(x, y + 2, min(H - 1, y + 17), mix(floor[1], (0, 0, 0), 0.15))
    return c


def arena_d():
    """Tenement brick: a wall of it, windows with somebody's light still
    on, a drainpipe, and pavement."""
    c = Canvas()
    br = ramp('cloth_red', t=0.12)
    mortar = lift(R['stone'][2], 0.25)
    c.rect(0, 0, W, HORIZON, mortar)
    for row, y in enumerate(range(0, HORIZON, 6)):
        off = 0 if row % 2 else 8
        for x in range(-off, W, 16):
            face = br[2] if (x // 16 + row) % 4 else br[1]
            c.rect(x + 1, y + 1, 14, 4, face)
            c.hline(x + 1, x + 14, y + 1, br[3])
    frame = ramp('wood_dark', t=0.15)
    glow_ = R['gold']
    for wx in (24, 124, 200):                 # windows
        lit = wx != 124
        if lit:
            glow(c, wx + 16, 22, 30, glow_[4])
        c.rect(wx - 2, 6, 36, 34, frame[1])
        c.rect(wx, 8, 32, 30, frame[3])
        pane = glow_[3] if lit else ramp('cloth_blue')[1]
        for (px, py) in ((2, 10), (17, 10), (2, 24), (17, 24)):
            c.rect(wx + px, py, 13, 12, pane)
            c.hline(wx + px, wx + px + 12, py, glow_[4] if lit else R['cloth_blue'][2])
        if not lit:                           # a curtain half drawn
            c.rect(wx + 2, 10, 6, 26, ramp('cloth_cream', t=0.0)[2])
            c.vline(wx + 7, 10, 35, R['cloth_cream'][1])
        c.rect(wx - 4, 40, 40, 3, lift(R['stone'][3], 0.25))   # the sill
        c.hline(wx - 4, wx + 35, 43, R['stone'][1])
    steel = ramp('steel')
    c.rect(98, 0, 5, HORIZON, steel[2])       # a drainpipe
    c.vline(98, 0, HORIZON - 1, steel[4])
    c.vline(102, 0, HORIZON - 1, steel[0])
    for y in (14, 38):
        c.rect(97, y, 7, 3, steel[1])
    c.rect(0, HORIZON - 5, W, 5, lift(R['stone'][2], 0.1))
    c.hline(0, W - 1, HORIZON - 5, lift(R['stone'][3], 0.25))
    c.hline(0, W - 1, HORIZON - 1, R['stone'][0])
    pave = ramp('sand', t=0.08)
    _ground(c, [mix(pave[1], pave[2], 0.2), mix(pave[1], pave[2], 0.6), pave[2],
                mix(pave[2], pave[3], 0.4)], seed=11)
    for k, y in enumerate(range(HORIZON + 12, H, 22)):    # paving slab joints
        c.hline(0, W - 1, y, pave[0])
        c.hline(0, W - 1, y + 1, lift(pave[3], 0.1))
        for x in range((k % 2) * 26, W, 52):
            c.vline(x, y + 2, min(H - 1, y + 21), pave[0])
    return c


def arena_e():
    """The city at night: a skyline with the lights still on, a sky with
    stars in it, and the street."""
    c = Canvas()
    b = R['cloth_blue']
    c.bands(0, HORIZON, [mix(b[0], (10, 12, 24), 0.4), b[0], mix(b[0], b[1], 0.5), b[1]])
    rng = random.Random(11)
    for _ in range(36):                       # stars
        c.put(rng.randrange(0, W), rng.randrange(0, 26), (230, 232, 244) if rng.random() < 0.5 else (170, 180, 210))
    c.ellipse(214, 10, 6, 6, (238, 234, 210))  # the moon
    c.ellipse(216, 9, 5, 5, mix(b[0], (10, 12, 24), 0.4))
    far = mix(b[0], (20, 20, 30), 0.25)
    near = (34, 34, 48)
    x = 0
    while x < W:                              # far skyline
        w, h = rng.randrange(14, 30), rng.randrange(14, 34)
        c.rect(x, HORIZON - h, w, h, far)
        c.hline(x, x + w - 1, HORIZON - h, mix(far, b[2], 0.3))
        x += w
    x = -6
    while x < W:                              # near buildings, lit windows
        w, h = rng.randrange(26, 44), rng.randrange(22, 44)
        top = HORIZON - h
        c.rect(x, top, w, h, near)
        c.hline(x, x + w - 1, top, (64, 64, 86))
        c.vline(x, top, HORIZON - 1, (48, 48, 64))
        for wy in range(top + 5, HORIZON - 5, 7):
            for wxx in range(x + 4, x + w - 5, 6):
                if rng.random() < 0.45:
                    c.rect(wxx, wy, 3, 3, R['gold'][3] if rng.random() < 0.7 else R['gold'][4])
        x += w + rng.randrange(0, 4)
    c.hline(0, W - 1, HORIZON - 1, (20, 20, 28))
    c.rect(0, HORIZON, W, 4, (88, 88, 100))   # the kerb
    c.hline(0, W - 1, HORIZON, (120, 120, 132))
    road = [(54, 56, 70), (62, 64, 78), (72, 74, 88), (82, 84, 98)]
    c.bands(HORIZON + 4, H, road)
    for x in range(0, W, 40):                 # lane markings
        c.rect(x + 6, 128, 20, 2, (210, 204, 172))
    for x, y in ((40, 100), (150, 112), (226, 96), (100, 168)):   # puddles with the lights in them
        c.ellipse(x, y, 16, 3, (80, 86, 116))
        c.hline(x - 8, x + 2, y, R['gold'][3])
        c.hline(x + 4, x + 6, y, R['gold'][4])
    return c


# ---------------------------------------------------------------- scenery --
#
#  Pieces the story's scenes are built from.

def line(c, x0, y0, x1, y1, col, thick=1):
    n = int(max(abs(x1 - x0), abs(y1 - y0), 1))
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        y = y0 + (y1 - y0) * i / n
        c.rect(int(round(x - thick / 2)), int(round(y - thick / 2)), thick, thick, col)


def cloud(c, x, y, w, cols):
    """A GBA cloud: a row of puffs, lit along their tops, a flat shaded
    base. cols = (shade, face, light)."""
    rng = random.Random(x * 31 + y)
    puffs = []
    px = x
    while px < x + w:
        r = rng.randrange(5, 11)
        puffs.append((px + r, y - rng.randrange(0, r), r))
        px += r + rng.randrange(2, 6)
    for (cx, cy, r) in puffs:
        c.ellipse(cx, cy + 1, r + 1, r * 0.7 + 1, cols[0])
    for (cx, cy, r) in puffs:
        c.ellipse(cx, cy, r, r * 0.7, cols[1])
    for (cx, cy, r) in puffs:
        c.ellipse(cx - r * 0.25, cy - r * 0.3, r * 0.6, r * 0.35, cols[2])
    c.rect(x, y + 1, px - x + 6, 4, cols[0])
    c.hline(x + 2, px + 3, y + 1, cols[1])


def skyline(c, base, seed, body, edge, lit, lo=20, hi=50, gap=(0, 4), wmin=22, wmax=40, p=0.4):
    rng = random.Random(seed)
    x = -rng.randrange(0, 10)
    while x < c.w:
        w, h = rng.randrange(wmin, wmax), rng.randrange(lo, hi)
        top = base - h
        c.rect(x, top, w, h, body)
        c.hline(x, x + w - 1, top, edge)
        if lit:
            for wy in range(top + 5, base - 5, 7):
                for wx in range(x + 4, x + w - 5, 6):
                    if rng.random() < p:
                        c.rect(wx, wy, 3, 3, rng.choice(lit))
        x += w + rng.randrange(*gap)


def night_sky(c, y0, y1, seed=1, moon=None):
    b = R['cloth_blue']
    c.bands(y0, y1, [(18, 20, 40), mix((18, 20, 40), b[0], 0.6), b[0], mix(b[0], b[1], 0.5)])
    rng = random.Random(seed)
    for _ in range(40):
        c.put(rng.randrange(0, c.w), rng.randrange(y0, y0 + (y1 - y0) * 2 // 3),
              (232, 232, 244) if rng.random() < 0.4 else (150, 160, 200))
    if moon:
        mx, my = moon
        c.ellipse(mx, my, 9, 9, (246, 242, 220))
        c.ellipse(mx - 2, my - 2, 3, 2, (255, 255, 246))
        c.put(mx + 3, my + 2, (218, 212, 186))
        c.put(mx + 4, my - 3, (218, 212, 186))


def tree(c, x, base, seed, bark, leaf, branch_left=None):
    """A street tree: a trunk that thickens to the ground, a round canopy in
    four clumps, lit from the top left. branch_left = (y, x_end): a bough
    sticking out of the canopy with nothing on it -- yet."""
    c.rect(x - 3, base - 82, 7, 82, bark[1])
    c.vline(x - 3, base - 82, base - 1, bark[2])
    c.vline(x + 3, base - 82, base - 1, bark[0])
    for k in range(4):                        # the root flare
        c.hline(x - 4 - k, x + 4 + k, base - 4 + k, bark[1])
    if branch_left:
        by, bx = branch_left
        line(c, x - 2, by + 8, bx, by, bark[1], 3)
        line(c, x - 2, by + 7, bx, by - 1, bark[2], 1)
        line(c, bx + 8, by, bx - 2, by - 5, bark[1], 2)
    rng = random.Random(seed)
    clumps = [(x - 14, base - 104, 22), (x + 14, base - 110, 24), (x, base - 128, 22),
              (x - 22, base - 120, 14), (x + 26, base - 94, 14)]
    for (cx, cy, r) in clumps:
        c.ellipse(cx, cy, r + 1, r * 0.8 + 1, leaf[0])
    for (cx, cy, r) in clumps:
        c.ellipse(cx, cy, r, r * 0.8, leaf[1])
    for (cx, cy, r) in clumps:
        c.ellipse(cx - r * 0.3, cy - r * 0.3, r * 0.6, r * 0.45, leaf[2])
        for _ in range(6):                    # leaf texture: little arcs
            lx, ly = cx + rng.randrange(-r + 4, r - 4), cy + rng.randrange(-int(r * 0.6), int(r * 0.6))
            c.hline(lx, lx + 2, ly, leaf[0])
            c.put(lx + 1, ly - 1, leaf[3] if len(leaf) > 3 else leaf[2])


def street_front(c, top, bottom, seed, lit=True):
    """A row of Seattle walk-ups: brick, painted siding, bay windows, a
    fire escape, the ground floor a shop with its shutter down."""
    rng = random.Random(seed)
    fronts = [(ramp('cloth_red', t=0.0), 0), (ramp('cloth_green', t=0.05), 1),
              (ramp('stone_ancient', t=0.0), 0), (ramp('cloth_blue', t=0.05), 1),
              (ramp('wood', t=0.0), 1)]
    x = -8
    k = 0
    night = (0.55, (24, 26, 52))
    while x < c.w:
        w = rng.randrange(56, 76)
        h = rng.randrange(bottom - top - 20, bottom - top)
        y0 = bottom - h
        cols, siding = fronts[k % len(fronts)]
        cols = [mix(col, night[1], night[0]) for col in cols]
        c.rect(x, y0, w, h, cols[2])
        if siding:                            # clapboard
            for yy in range(y0 + 3, bottom, 4):
                c.hline(x, x + w - 1, yy, cols[1])
        else:                                 # brick, read as courses
            for yy in range(y0 + 2, bottom, 4):
                for xx in range(x + (yy // 4 % 2) * 4, x + w, 8):
                    c.hline(xx, xx + 5, yy, cols[1])
        c.rect(x, y0, w, 4, cols[3])          # cornice
        c.hline(x, x + w - 1, y0 + 4, cols[0])
        c.vline(x, y0, bottom - 1, cols[0])
        for row, wy in enumerate(range(y0 + 10, bottom - 30, 22)):
            for wx in range(x + 8, x + w - 16, 20):
                on = lit and rng.random() < 0.35
                glass = R['gold'][3] if on else (40, 46, 74)
                c.rect(wx - 1, wy - 1, 14, 16, cols[0])
                c.rect(wx, wy, 12, 14, glass)
                c.hline(wx, wx + 11, wy, R['gold'][4] if on else (60, 68, 100))
                c.vline(wx + 6, wy, wy + 13, cols[0])
                c.rect(wx - 2, wy + 14, 16, 2, cols[3])
        if k % 2 == 0:                        # a fire escape
            fx = x + w // 2 - 12
            for wy in range(y0 + 26, bottom - 30, 22):
                c.hline(fx, fx + 24, wy, (30, 30, 40))
                for bx in range(fx, fx + 25, 3):
                    c.put(bx, wy - 1, (30, 30, 40))
                line(c, fx + 2, wy, fx + 20, wy + 22, (30, 30, 40))
        sy = bottom - 24                      # the shopfront, shutter down
        c.rect(x + 4, sy, w - 8, 24, (56, 58, 70))
        for yy in range(sy + 2, bottom, 3):
            c.hline(x + 5, x + w - 6, yy, (44, 46, 58))
        c.rect(x + 2, sy - 4, w - 4, 4, fronts[(k + 2) % 5][0][3])     # awning
        c.hline(x + 2, x + w - 3, sy - 1, fronts[(k + 2) % 5][0][1])
        x += w
        k += 1


def scene_street():
    """2:23 A.M., a Seattle street in the rain: walk-ups, a streetlight,
    the wet road, and the tree the cat goes up."""
    c = Canvas()
    night_sky(c, 0, 60, seed=3, moon=(30, 16))
    skyline(c, 60, 21, (30, 32, 56), (44, 46, 76), [R['gold'][3]], lo=14, hi=40, p=0.2)
    street_front(c, 26, 140, seed=4)
    #  Pavement, kerb, road.
    pave = (104, 106, 122)
    c.rect(0, 140, W, 32, pave)
    for y in (140, 156):
        c.hline(0, W - 1, y, (128, 130, 146))
    for x in range(0, W, 24):
        c.vline(x, 141, 155, (84, 86, 100))
        c.vline(x + 12, 157, 171, (84, 86, 100))
    c.rect(0, 172, W, 3, (140, 142, 156))     # kerb
    c.hline(0, W - 1, 175, (50, 50, 62))
    c.bands(176, H, [(42, 44, 60), (48, 50, 68)])
    #  The streetlight, and the pool it throws.
    lx = 104
    glow(c, lx + 10, 150, 34, (240, 220, 150))
    c.rect(lx, 52, 3, 120, (50, 54, 66))
    c.vline(lx, 52, 171, (80, 84, 98))
    line(c, lx + 1, 52, lx + 14, 46, (50, 54, 66), 2)
    c.rect(lx + 10, 46, 9, 3, (40, 42, 52))
    c.rect(lx + 11, 49, 7, 2, (255, 246, 200))
    #  Reflections in the wet road: the lit things, stretched downward.
    for x in range(0, W):
        p = c.get(x, 130)
        if p and p[0] > 180 and p[1] > 140:
            for y in range(178, H, 2):
                c.put(x, y, mix(p, (48, 50, 68), 0.55))
    for y in range(178, H, 2):
        c.hline(lx + 8, lx + 20, y, mix((255, 246, 200), (48, 50, 68), 0.5))
    tree(c, 186, 172, 7, ramp('wood_dark', t=0.0), [mix(col, (20, 24, 50), 0.45) for col in R['leaves'][:4]],
         branch_left=(93, 146))
    return c


def scene_collapse():
    """Ninety seconds later: nothing standing, dust in the air, the street a
    field of rubble."""
    c = Canvas()
    dust = ramp('sand', t=0.0)
    c.bands(0, 120, [mix(dust[1], (40, 30, 30), 0.5), mix(dust[1], dust[2], 0.2), dust[2],
                     mix(dust[2], dust[3], 0.5), dust[3]])
    c.ellipse(190, 40, 14, 14, mix(dust[5], (255, 255, 255), 0.3))   # the sun through it
    c.ellipse(190, 40, 10, 10, (250, 238, 200))
    for (x, y, w) in ((10, 30, 50), (120, 50, 70), (200, 70, 50)):
        cloud(c, x, y, w, (mix(dust[1], dust[2], 0.5), dust[2], dust[3]))
    rng = random.Random(12)
    stumps = (60, 82, 70, 54, 90, 64)
    x = 0
    for k, hgt in enumerate(stumps):          # what is left of the buildings
        w = rng.randrange(30, 52)
        top = 128 - hgt
        col = ramp(('cloth_red', 'stone', 'stone_ancient')[k % 3], t=0.0)
        col = [mix(cc, dust[2], 0.45) for cc in col]
        pts = [(x, 130), (x, top + rng.randrange(0, 12)), (x + w // 3, top), (x + w // 2, top + 10),
               (x + 2 * w // 3, top + rng.randrange(2, 16)), (x + w, top + 20), (x + w, 130)]
        c.poly(pts, col[1])
        for wy in range(top + 14, 120, 16):   # empty windows
            for wx in range(x + 5, x + w - 8, 12):
                if rng.random() < 0.7:
                    c.rect(wx, wy, 6, 8, col[0])
        c.vline(x, top, 129, col[2])
        x += w + rng.randrange(4, 14)
    c.rect(0, 128, W, H - 128, dust[1])       # the rubble field
    c.bands(128, H, [mix(dust[1], dust[0], 0.4), dust[1], mix(dust[1], dust[2], 0.4)])
    for _ in range(90):                       # chunks of concrete, brick, rebar
        bx, by = rng.randrange(-10, W), rng.randrange(124, H)
        w, h = rng.randrange(4, 14), rng.randrange(3, 8)
        col = rng.choice((ramp('stone', t=0.1), ramp('cloth_red', t=0.1), ramp('stone_ancient', t=0.1)))
        c.block(bx, by, w, h, col[2], col[3], col[1], col[0])
    for _ in range(8):
        bx, by = rng.randrange(0, W), rng.randrange(130, H)
        line(c, bx, by, bx + rng.randrange(-8, 9), by - rng.randrange(6, 14), (70, 52, 44))
    return c


def scene_sky():
    """The sky, when it starts talking: dusk gone wrong, cloud banks lit
    from underneath, a flattened horizon."""
    c = Canvas()
    a, f = R['arcane'], R['fire']
    c.bands(0, 150, [mix(a[0], (16, 12, 30), 0.4), a[0], a[1], mix(a[1], a[2], 0.5), a[2],
                     mix(a[2], f[3], 0.4), mix(a[3], f[4], 0.5), f[5]])
    for (x, y, w) in ((-10, 24, 90), (140, 16, 120), (60, 46, 80), (180, 60, 90), (0, 100, 70),
                      (110, 118, 110), (200, 134, 70)):
        cool = y < 80
        cols = ((a[1], a[2], a[3]) if cool else (mix(a[2], f[2], 0.5), f[3], f[5]))
        cloud(c, x, y, w, cols)
    skyline(c, 162, 33, (40, 26, 52), (70, 46, 80), None, lo=4, hi=22, wmin=10, wmax=30, gap=(0, 8))
    c.rect(0, 162, W, H - 162, (34, 22, 44))
    c.hline(0, W - 1, 162, (64, 42, 74))
    return c


def scene_stairs():
    """The stairwell down: a stone arch, steps going down into the dark,
    torches either side, and the landing the two of them stand on."""
    c = Canvas()
    st = ramp('stone_ancient', t=0.0)
    c.rect(0, 0, W, 132, st[1])
    rng = random.Random(8)
    y, row = 0, 0
    while y < 132:                            # the wall
        h = 12
        x = -((row * 19) % 28)
        while x < W:
            w = rng.randrange(22, 34)
            face = st[2] if rng.random() < 0.7 else st[3]
            c.block(x + 1, y + 1, w - 2, h - 2, face, st[4] if face == st[3] else st[3], st[1], st[0])
            x += w
        y += h
        row += 1
    #  The arch, and the dark it opens onto.
    ax, aw, atop = 128, 92, 30
    c.rect(ax - aw // 2 - 8, atop + 10, aw + 16, 132 - atop - 10, st[3])
    c.ellipse(ax, atop + 20, aw // 2 + 8, 28, st[3])
    for k in range(9):                        # voussoirs
        ang = math.pi * (k + 0.5) / 9
        x0 = ax - math.cos(ang) * (aw // 2 + 2)
        y0 = atop + 20 - math.sin(ang) * 22
        x1 = ax - math.cos(ang) * (aw // 2 + 8)
        y1 = atop + 20 - math.sin(ang) * 28
        line(c, x0, y0, x1, y1, st[1])
    c.rect(ax - aw // 2, atop + 20, aw, 112 - atop, (14, 12, 20))
    c.ellipse(ax, atop + 20, aw // 2, 22, (14, 12, 20))
    #  Steps down into it, seen from above: only the treads show, each
    #  under the shadow the nosing of the one before throws, each lit less
    #  than the one nearer. The tunnel's sides close in as it goes down.
    for k in range(9):
        sy = 132 - k * 8
        wk = aw - 4 - k * 4
        shade = max(0.0, 1 - k * 0.13)
        tread = mix((14, 12, 20), st[4], shade)
        nose = mix((14, 12, 20), st[2], shade)
        c.rect(ax - wk // 2, sy - 8, wk, 6, tread)
        c.hline(ax - wk // 2, ax + wk // 2 - 1, sy - 8, mix(tread, (255, 255, 255), 0.15 * shade))
        c.rect(ax - wk // 2, sy - 2, wk, 2, nose)
    for side in (-1, 1):                      # the tunnel walls, falling away
        for k in range(9):
            sy = 132 - k * 8
            x0 = ax + side * (aw // 2 - 2 - k * 2)
            c.rect(min(x0, x0 + side * 2), sy - 8, 3, 8, mix((14, 12, 20), st[1], max(0.0, 1 - k * 0.13)))
    #  Torches either side, the wall lit round them.
    fire = R['fire']
    iron = ramp('steel')
    for tx in (44, 212):
        glow(c, tx, 52, 34, fire[5])
        c.rect(tx - 2, 58, 4, 12, iron[1])
        c.hline(tx - 4, tx + 3, 58, iron[3])
        c.ellipse(tx, 50, 4.5, 8, fire[2])
        c.ellipse(tx, 52, 3.2, 5.5, fire[4])
        c.ellipse(tx, 53, 1.6, 3, fire[6])
    #  The landing.
    floor = ramp('stone', t=0.05)
    c.bands(132, H, [floor[1], mix(floor[1], floor[2], 0.5), floor[2], mix(floor[2], floor[3], 0.4)])
    c.hline(0, W - 1, 132, floor[3])
    for k, y in enumerate(range(146, H, 16)):
        c.hline(0, W - 1, y, floor[0])
        for x in range((k * 21) % 40, W, 40):
            c.vline(x, y + 1, min(H - 1, y + 15), floor[0])
    #  The stairwell continues in the floor: a lip and the top step.
    c.rect(ax - aw // 2, 132, aw, 4, (20, 18, 26))
    return c


def scene_title():
    """The title: the city at the last minute of dusk, a glow coming out of
    the ground where the stairs are, and the rubble the two of them stand
    on."""
    c = Canvas()
    b, f, a = R['cloth_blue'], R['fire'], R['arcane']
    c.bands(0, 140, [(16, 16, 36), mix((16, 16, 36), b[0], 0.6), b[0], mix(b[0], a[1], 0.5),
                     a[1], mix(a[2], f[2], 0.4), mix(f[3], a[2], 0.3), f[4]])
    rng = random.Random(2)
    for _ in range(30):
        c.put(rng.randrange(0, W), rng.randrange(0, 50), (220, 224, 244))
    for (x, y, w) in ((-6, 92, 70), (170, 84, 96), (90, 104, 60)):
        cloud(c, x, y, w, (mix(a[1], f[2], 0.4), mix(a[2], f[3], 0.5), f[5]))
    skyline(c, 140, 41, (34, 24, 50), (60, 42, 78), [f[5], R['gold'][3]], lo=16, hi=56, p=0.25)
    c.rect(0, 140, W, H - 140, (40, 28, 46))
    c.bands(140, H, [(40, 28, 46), (52, 36, 54), (62, 44, 60)])
    #  The way down, glowing.
    glow(c, 128, 160, 60, f[4])
    c.ellipse(128, 162, 44, 9, (24, 14, 22))
    c.ellipse(128, 161, 38, 6, f[3])
    c.ellipse(128, 160, 28, 4, f[5])
    c.ellipse(128, 160, 16, 2, f[6])
    for _ in range(60):                       # rubble the two of them stand on
        bx, by = rng.randrange(-8, W), rng.randrange(146, H)
        if abs(bx - 128) < 48 and abs(by - 162) < 12:
            continue
        w, h = rng.randrange(4, 12), rng.randrange(3, 7)
        c.block(bx, by, w, h, (78, 58, 72), (110, 84, 96), (58, 42, 56), (30, 20, 30))
    return c


def scene_gameover():
    """Where it ended: a dungeon room gone dark red."""
    c = Canvas()
    st = [mix(col, (60, 10, 16), 0.45) for col in ramp('stone_ancient', t=0.0)]
    c.rect(0, 0, W, 140, st[0])
    rng = random.Random(6)
    y, row = 0, 0
    while y < 140:
        h = 12
        x = -((row * 19) % 28)
        while x < W:
            w = rng.randrange(22, 34)
            c.block(x + 1, y + 1, w - 2, h - 2, st[1], st[2], st[0], mix(st[0], (0, 0, 0), 0.3))
            x += w
        y += h
        row += 1
    for cx in (18, 236):                      # chains, hanging from rings
        c.ellipse(cx, 14, 3, 3, (90, 70, 70))
        c.ellipse(cx, 14, 1.5, 1.5, st[0])
        for k in range(10):
            y = 18 + k * 5
            if k % 2:
                c.rect(cx - 1, y, 3, 5, (100, 78, 78))
                c.vline(cx, y + 1, y + 3, st[0])
            else:
                c.rect(cx - 2, y, 5, 5, (100, 78, 78))
                c.rect(cx - 1, y + 1, 3, 3, st[0])
                c.hline(cx - 2, cx + 2, y, (140, 110, 108))
    floor = [mix(col, (60, 10, 16), 0.5) for col in ramp('stone', t=0.0)]
    c.bands(140, H, [floor[0], floor[1], floor[2]])
    c.hline(0, W - 1, 140, floor[3])
    for _ in range(6):                        # what was left on the floor
        bx, by = rng.randrange(10, W - 20), rng.randrange(150, H - 8)
        c.ellipse(bx, by, rng.randrange(6, 14), 2.5, mix(R['blood'][1], floor[1], 0.3))
    return c


def scene_victory():
    """Out: sunrise, over water, above ground."""
    c = Canvas()
    h, w_ = R['holy'], R['water']
    c.bands(0, 112, [mix(w_[2], (90, 120, 200), 0.5), w_[3], mix(w_[3], h[3], 0.4), h[3], h[4],
                     (252, 240, 210)])
    for (x, y, w) in ((10, 26, 70), (150, 18, 90), (90, 60, 60), (200, 76, 50)):
        cloud(c, x, y, w, (mix(w_[4], h[2], 0.4), (250, 246, 236), (255, 255, 255)))
    c.ellipse(128, 112, 22, 22, (255, 236, 160))      # the sun, half up
    c.ellipse(128, 112, 17, 17, (255, 250, 214))
    c.bands(112, 150, [w_[3], mix(w_[2], w_[3], 0.5), w_[2], mix(w_[1], w_[2], 0.5)])
    c.hline(0, W - 1, 112, (255, 246, 210))
    for k, y in enumerate(range(114, 150, 3)):        # the sun's path on the water
        half = 6 + k * 2
        for x in range(128 - half, 128 + half, 4):
            c.hline(x + (k % 2) * 2, x + (k % 2) * 2 + 1, y, (255, 240, 180))
    rng = random.Random(4)
    for _ in range(40):                       # glints
        x, y = rng.randrange(0, W), rng.randrange(116, 150)
        c.hline(x, x + 2, y, mix(w_[4], (255, 255, 255), 0.4))
    sand = ramp('sand', t=0.1)
    c.bands(150, H, [sand[3], mix(sand[3], sand[4], 0.5), sand[4]])
    for x in range(0, W, 2):                  # the waterline, foaming
        y = 150 + int(1.5 * math.sin(x * 0.2))
        c.put(x, y, (255, 255, 255))
        c.put(x + 1, y + 1, (232, 240, 236))
    for _ in range(20):
        x, y = rng.randrange(0, W), rng.randrange(156, H)
        c.hline(x, x + 1, y, sand[2])
    return c


# -------------------------------------------------------------------- pads --
#
#  The ellipse a combatant stands on, in each material's ground colours: a
#  rim a step darker, the front in shade, the face, and a lit lip along the
#  back edge. render.c draws them (gfx_pad) at whatever size the combatant
#  needs; these are the colours, which tools/forge.py writes into
#  backdrops.c beside the arenas.

def _pad(ground):
    face = lift(ground, 0.26)
    return (mix(ground, (0, 0, 0), 0.34), mix(face, ground, 0.6), face, lift(face, 0.3))


PAD_COLOURS = {
    'a': _pad(mix(ramp('stone', t=0.22)[2], ramp('stone', t=0.22)[3], 0.5)),
    'b': _pad(mix(R['sand'][1], R['sand'][2], 0.3)),
    'c': _pad(mix(ramp('stone', t=0.08)[1], ramp('stone', t=0.08)[2], 0.6)),
    'd': _pad(mix(ramp('sand', t=0.08)[1], ramp('sand', t=0.08)[2], 0.5)),
    'e': _pad((70, 72, 88)),
}


# ------------------------------------------------------------------- tiles --
#
#  The dungeon, from above: a floor and a wall-top for each material, 32 x 32
#  (view2d.c reads one 16 x 16 quarter per tile, so a texture is a two-by-two
#  block of GBA tiles and has to wrap at its edges). The renderer darkens the
#  wall-tops and lights both, so they are drawn at full brightness here.

T = 32


class Tile(Canvas):
    """A canvas whose edges wrap, so whatever runs off one side comes in on
    the other and the texture repeats without a seam."""

    def __init__(self, fill):
        Canvas.__init__(self, T, T, fill)

    def put(self, x, y, c):
        self.px[(y % T) * T + (x % T)] = c

    def rect(self, x, y, w, h, c):
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.put(i, j, c)

    def speckle(self, n, cols, seed):
        rng = random.Random(seed)
        for _ in range(n):
            self.put(rng.randrange(T), rng.randrange(T), rng.choice(cols))


def floor_a():
    """Poured concrete in sixteen-pixel slabs, the joints sawn in."""
    g = ramp('stone', t=0.30)
    c = Tile(g[3])
    for (x, y) in ((0, 0), (16, 0), (0, 16), (16, 16)):
        c.block(x, y, 16, 16, g[3], g[4], mix(g[2], g[3], 0.5), g[1])
    c.speckle(10, [g[2]], 1)
    c.speckle(5, [g[4]], 2)
    c.vline(22, 3, 6, g[2])                   # a hairline crack
    c.put(23, 7, g[2])
    c.put(23, 8, g[2])
    return c


def floor_b():
    """Floorboards: four planks to a texture, joints staggered, nail heads."""
    w = ramp('wood', t=0.12)
    c = Tile(w[3])
    for k in range(4):
        y = k * 8
        face = (w[3], w[2], w[3], mix(w[2], w[3], 0.5))[k]
        c.rect(0, y, T, 8, face)
        c.hline(0, T - 1, y, w[4])
        c.hline(0, T - 1, y + 7, w[1])
        j = (k * 13 + 5) % T                  # where this plank meets the next
        c.vline(j, y + 1, y + 6, w[1])
        c.vline(j + 1, y + 1, y + 6, w[4])
        c.put(j - 3, y + 3, w[0])
        c.put(j + 4, y + 3, w[0])
        c.hline((j + 12) % T, (j + 12) % T + 5, y + 4, mix(face, w[1], 0.5))   # grain
    return c


def floor_c():
    """Flagstones, unevenly cut, in three greys."""
    g = ramp('stone_ancient', t=0.16)
    c = Tile(g[1])
    for (x, y, w, h, f) in ((0, 0, 20, 14, 3), (20, 0, 12, 14, 2), (0, 14, 10, 18, 2),
                            (10, 14, 14, 10, 3), (24, 14, 8, 18, 3), (10, 24, 14, 8, 2)):
        c.block(x, y, w - 1, h - 1, g[f], g[f + 1], mix(g[f], g[1], 0.5), g[0])
    c.speckle(8, [g[2]], 3)
    return c


def floor_d():
    """Tenement linoleum: a worn two-tone check."""
    a, b = lift(R['cloth_cream'][3], 0.0), lift(R['sand'][3], 0.1)
    c = Tile(a)
    for j in range(4):
        for i in range(4):
            c.rect(i * 8, j * 8, 8, 8, a if (i + j) % 2 else b)
            c.hline(i * 8, i * 8 + 7, j * 8 + 7, mix(a if (i + j) % 2 else b, (0, 0, 0), 0.10))
    c.checker(9, 18, 8, 6, mix(b, R['sand'][1], 0.35))     # scuffed where people walk
    c.speckle(6, [R['sand'][2]], 4)
    return c


def floor_e():
    """Asphalt at night: dark, flecked, a pale tar seam across it."""
    base = (66, 70, 86)
    c = Tile(base)
    c.speckle(40, [(56, 60, 74), (80, 84, 100)], 5)
    c.speckle(6, [(110, 112, 126)], 6)
    for x in range(T):                        # a tar seam, wandering
        y = 20 + int(2 * math.sin(x * 2 * math.pi / T))
        c.put(x, y, (46, 48, 60))
        c.put(x, y - 1, (90, 92, 108))
    return c


def wall_a():
    """Breeze block, seen from above: courses of grey blocks with a lit lip."""
    g = ramp('stone', t=0.24)
    c = Tile(g[2])
    for row in range(4):
        y = row * 8
        off = 0 if row % 2 else 8
        for x in range(-off, T, 16):
            c.block(x, y, 15, 7, g[3], g[4], g[2], g[1])
    return c


def wall_b():
    """Boards laid crossways, a dark gap between each."""
    w = ramp('wood_dark', t=0.15)
    c = Tile(w[2])
    for k in range(4):
        x = k * 8
        c.rect(x, 0, 7, T, w[2] if k % 2 else w[3])
        c.vline(x, 0, T - 1, w[3] if k % 2 else lift(w[3], 0.15))
        c.vline(x + 7, 0, T - 1, w[0])
        c.put(x + 3, (k * 11) % T, w[0])
        c.put(x + 3, (k * 11 + 16) % T, w[0])
    return c


def wall_c():
    """Cut stone blocks with moss in the joints."""
    g = ramp('stone_ancient', t=0.10)
    moss = ramp('grass', t=0.05)
    c = Tile(g[1])
    for row in range(2):
        y = row * 16
        off = 0 if row % 2 else 10
        for x, w in ((-off, 20), (20 - off, 12), (32 - off, 20)):
            c.block(x, y, w - 1, 15, g[2], g[3], mix(g[2], g[1], 0.5), g[0])
    c.speckle(7, [moss[2], moss[3]], 7)
    return c


def wall_d():
    """Brick, from above: red courses, pale mortar."""
    br = ramp('cloth_red', t=0.10)
    mortar = lift(R['stone'][3], 0.15)
    c = Tile(mortar)
    for row in range(5):
        y = row * 6 + (row * 2) // 5
        off = 0 if row % 2 else 8
        for x in range(-off, T, 16):
            f = br[2] if (x // 16 + row) % 3 else br[1]
            c.rect(x + 1, y + 1, 14, 4, f)
            c.hline(x + 1, x + 14, y + 1, br[3])
    return c


def wall_e():
    """A city roof: tar and gravel, a parapet coping, a vent."""
    c = Tile((48, 50, 64))
    c.speckle(50, [(40, 42, 54), (60, 62, 78)], 8)
    c.rect(0, 0, T, 3, (96, 98, 112))         # coping along the edge
    c.hline(0, T - 1, 0, (128, 130, 144))
    c.hline(0, T - 1, 3, (30, 30, 40))
    c.block(18, 12, 9, 9, (110, 114, 124), (150, 154, 160), (80, 84, 96), (26, 26, 34))
    c.rect(20, 15, 5, 3, (40, 42, 52))
    return c


TILES = {'tile_floor_a': floor_a, 'tile_floor_b': floor_b, 'tile_floor_c': floor_c,
         'tile_floor_d': floor_d, 'tile_floor_e': floor_e, 'tile_wall_a': wall_a,
         'tile_wall_b': wall_b, 'tile_wall_c': wall_c, 'tile_wall_d': wall_d,
         'tile_wall_e': wall_e}


def write_tile(name, canvas):
    """32 colours at most (the renderer's lighting tables), sorted dark to
    light so index 0 is the material's shadow."""
    import png
    ds = [tuple((v >> 3) * 255 // 31 for v in p) for p in canvas.px]
    used = sorted(set(ds), key=lambda c: (c[0] * 3 + c[1] * 6 + c[2]))
    assert len(used) <= 32, "%s has %d colours" % (name, len(used))
    index = {c: k for k, c in enumerate(used)}
    path = os.path.join(ROOT, 'assets', 'tiles', name + '.png')
    png.write_indexed(path, T, T, used + [(0, 0, 0)] * (256 - len(used)), bytes(index[c] for c in ds))
    print('wrote %s (%d colours)' % (name, len(used)))


# ------------------------------------------------------------------ output --

SCENES = {'arena_a': arena_a, 'arena_b': arena_b, 'arena_c': arena_c,
          'arena_d': arena_d, 'arena_e': arena_e, 'title': scene_title,
          'street': scene_street, 'collapse': scene_collapse, 'sky': scene_sky,
          'stairs': scene_stairs, 'gameover': scene_gameover, 'victory': scene_victory}

COLOURS = 64          # per scene, the same budget a sprite gets


def write(name, canvas):
    """The scene as an indexed PNG of at most COLOURS colours, each already
    one the DS can show (5 bits a channel)."""
    import png
    ds = [tuple((v >> 3) * 255 // 31 for v in p) for p in canvas.px]
    used = sorted(set(ds))
    if len(used) > COLOURS:
        from PIL import Image
        im = Image.new('RGB', (canvas.w, canvas.h))
        im.putdata(ds)
        q = im.quantize(colors=COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        pal = q.getpalette()[:COLOURS * 3]
        palette = [tuple((v >> 3) * 255 // 31 for v in pal[i:i + 3]) for i in range(0, len(pal), 3)]
        pix = q.tobytes()
    else:
        palette = used
        index = {c: k for k, c in enumerate(used)}
        pix = bytes(index[c] for c in ds)
    palette = palette + [(0, 0, 0)] * (256 - len(palette))
    path = os.path.join(ROOT, 'assets', 'bg', name + '.png')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    png.write_indexed(path, canvas.w, canvas.h, palette, pix)
    print('wrote %s (%d colours)' % (name, min(len(used), COLOURS)))


if __name__ == '__main__':
    for name in sys.argv[1:] or sorted(SCENES) + sorted(TILES):
        if name in TILES:
            write_tile(name, TILES[name]())
        else:
            write(name, SCENES[name]())
