"""The drawing toolkit the cast is built with.

Shapes go down first, in ramps that are lit from the upper left. Two passes
afterwards do most of the work of making the result look drawn rather than
assembled: a cool rim light along the lower-right edge, and an outline that
takes its colour from whatever material it is wrapping instead of being a flat
black key line.
"""
import math

from palettes import outline_for, ramp as make_ramp, rgb555, rim_for

# The key light: up and to the left, slightly in front of the sprite. Shading is
# ambient plus lambert against this, which is what puts the highlight off-centre
# instead of filling the middle of every form with the top of its ramp.
LIGHT = (-0.52, -0.62, 0.59)
AMBIENT_TERM = 0.16


class Sprite:
    """An indexed canvas plus the palette it is accumulating. Index 0 is
    transparent and is never drawn."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = bytearray(w * h)
        self.pal = [(0, 0, 0)]
        self.outline_of = {}      # palette index -> its material's outline index
        self.rim_of = {}          # palette index -> its material's rim index

    # -- palette ------------------------------------------------------------
    def ink(self, rgb):
        rgb = tuple(int(v) for v in rgb)
        if rgb in self.pal:
            return self.pal.index(rgb)
        self.pal.append(rgb)
        return len(self.pal) - 1

    def ramp(self, base, steps=5, **kw):
        """Registers a material: returns its ramp of indices, darkest first, and
        remembers which outline and rim colours belong to it."""
        ids = [self.ink(c) for c in make_ramp(base, steps, **kw)]
        out = self.ink(outline_for(base))
        rim = self.ink(rim_for(base))
        for i in ids:
            self.outline_of[i] = out
            self.rim_of[i] = rim
        return ids

    # -- pixels -------------------------------------------------------------
    def put(self, x, y, idx):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y * self.w + x] = idx

    def get(self, x, y):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[y * self.w + x]
        return 0

    def rect(self, x0, y0, x1, y1, idx):
        for y in range(int(min(y0, y1)), int(max(y0, y1)) + 1):
            for x in range(int(min(x0, x1)), int(max(x0, x1)) + 1):
                self.put(x, y, idx)

    def line(self, x0, y0, x1, y1, idx, thick=1):
        steps = int(max(abs(x1 - x0), abs(y1 - y0), 1))
        for i in range(steps + 1):
            x = x0 + (x1 - x0) * i / steps
            y = y0 + (y1 - y0) * i / steps
            for oy in range(thick):
                for ox in range(thick):
                    self.put(x + ox - thick // 2, y + oy - thick // 2, idx)

    def poly(self, points, idx):
        ys = [p[1] for p in points]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            xs = []
            n = len(points)
            for i in range(n):
                x0, y0 = points[i]
                x1, y1 = points[(i + 1) % n]
                if (y0 <= y < y1) or (y1 <= y < y0):
                    xs.append(x0 + (x1 - x0) * (y - y0) / (y1 - y0))
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                for x in range(int(round(xs[i])), int(round(xs[i + 1])) + 1):
                    self.put(x, y, idx)

    # -- lit forms ----------------------------------------------------------
    def form(self, cx, cy, rx, ry, ids, light=LIGHT, wrap=1.0, squash=0.0):
        """A shaded ellipse.

        The surface normal is the hemisphere's, dotted with the key light and
        lifted by a little ambient. `wrap` softens the terminator (flesh, fur)
        or hardens it (metal, chitin); `squash` flattens the form toward a slab.
        """
        n = len(ids)
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                dx = (x - cx) / rx
                dy = (y - cy) / ry
                d2 = dx * dx + dy * dy
                if d2 > 1.0:
                    continue
                nz = math.sqrt(max(0.0, 1.0 - d2)) * (1.0 - squash) + squash
                lam = dx * light[0] + dy * light[1] + nz * light[2]
                lam = (lam + wrap - 1.0) / max(0.25, wrap)      # wrap the terminator
                v = AMBIENT_TERM + (1.0 - AMBIENT_TERM) * max(0.0, min(1.0, lam))
                self.put(x, y, ids[max(0, min(n - 1, int(v * (n - 1) + 0.5)))])

    def limb(self, x0, y0, x1, y1, w0, w1, ids, light=LIGHT):
        """A tapered limb: a capsule from (x0,y0) width w0 to (x1,y1) width w1,
        shaded across its short axis."""
        n = len(ids)
        length = max(1.0, math.hypot(x1 - x0, y1 - y0))
        ux, uy = (x1 - x0) / length, (y1 - y0) / length
        px, py = -uy, ux                       # perpendicular
        steps = int(length * 2)
        for i in range(steps + 1):
            t = i / steps
            cx = x0 + (x1 - x0) * t
            cy = y0 + (y1 - y0) * t
            w = (w0 + (w1 - w0) * t) / 2.0
            for j in range(-int(w) - 1, int(w) + 2):
                sv = j / max(0.6, w)
                if abs(sv) > 1.0:
                    continue
                nz = math.sqrt(max(0.0, 1.0 - sv * sv))
                lam = px * sv * light[0] + py * sv * light[1] + nz * light[2]
                v = AMBIENT_TERM + (1.0 - AMBIENT_TERM) * max(0.0, min(1.0, lam))
                self.put(cx + px * j, cy + py * j, ids[max(0, min(n - 1, int(v * (n - 1) + 0.5)))])

    def shade_band(self, x0, y0, x1, y1, shift=-1):
        """Nudges a rectangle of pixels along their own ramps: the cheap way to
        put a cast shadow under a chin or a coat."""
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                idx = self.get(x, y)
                if not idx:
                    continue
                fam = self.family(idx)
                if fam and idx in fam:
                    pos = max(0, min(len(fam) - 1, fam.index(idx) + shift))
                    self.put(x, y, fam[pos])

    families = None

    def register_family(self, ids):
        if self.families is None:
            self.families = []
        self.families.append(list(ids))
        return ids

    def family(self, idx):
        for fam in (self.families or []):
            if idx in fam:
                return fam
        return None

    def stamp(self, x0, y0, grid, key):
        """Blits a hand-drawn patch of pixels.

        Shading a face procedurally never looks like anything; eyes, brows and a
        mouth are placed pixel by pixel or they are not read as a face. `grid` is
        a list of equal-length strings and `key` maps each character to a palette
        index, with '.' left transparent.
        """
        for j, row in enumerate(grid):
            for i, ch in enumerate(row):
                if ch == '.':
                    continue
                idx = key.get(ch)
                if idx:
                    self.put(x0 + i, y0 + j, idx)

    # -- finishing passes ---------------------------------------------------
    def rim_light(self, strength=3, sides=((1, 1), (1, 0), (0, 1))):
        """Cool light along the edges facing away from the key.

        Kept deliberately mean: only pixels that are genuinely on a lower-right
        edge, and never a pixel that is already the top of its ramp, or the rim
        stops being an accent and starts bleaching the silhouette.
        """
        src = bytes(self.px)
        for y in range(self.h):
            for x in range(self.w):
                idx = src[y * self.w + x]
                if not idx or idx not in self.rim_of:
                    continue
                fam = self.family(idx)
                if fam and idx >= fam[-1]:
                    continue                     # already the brightest step
                exposed = 0
                for dx, dy in sides:
                    xx, yy = x + dx, y + dy
                    if not (0 <= xx < self.w and 0 <= yy < self.h) or not src[yy * self.w + xx]:
                        exposed += 1
                if exposed >= strength:
                    self.put(x, y, self.rim_of[idx])

    def outline(self, fallback=(10, 10, 16)):
        """Wraps the sprite in each material's own dark, and lightens the top-left
        of the line so the outline itself reads as lit."""
        src = bytes(self.px)
        default = self.ink(fallback)
        for y in range(self.h):
            for x in range(self.w):
                if src[y * self.w + x]:
                    continue
                neighbour = 0
                lit_side = False
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (1, -1), (-1, 1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < self.w and 0 <= yy < self.h and src[yy * self.w + xx]:
                        neighbour = src[yy * self.w + xx]
                        if dx >= 0 and dy >= 0:
                            lit_side = True
                        break
                if not neighbour:
                    continue
                colour = self.outline_of.get(neighbour, default)
                if lit_side and neighbour in self.rim_of:
                    base = self.pal[colour]
                    colour = self.ink(tuple(min(255, int(c * 1.55 + 8)) for c in base))
                self.put(x, y, colour)

    def separate(self, x0, y0, x1, y1, ids, depth=2):
        """Darkens a run of pixels so one form reads as being in front of
        another: the line where an arm crosses a chest, or a tail a flank."""
        for i in range(int(max(abs(x1 - x0), abs(y1 - y0))) + 1):
            t = i / max(1, int(max(abs(x1 - x0), abs(y1 - y0))))
            x = int(x0 + (x1 - x0) * t)
            y = int(y0 + (y1 - y0) * t)
            idx = self.get(x, y)
            if idx in ids:
                self.put(x, y, ids[max(0, ids.index(idx) - depth)])

    def soften_edges(self, ids, corners=2):
        """Internal anti-aliasing.

        A curve drawn on a grid turns in staircases. Darkening the fill pixel
        that sits in the inside corner of each step — never adding a colour, only
        stepping one down the material's own ramp — reads as a smooth edge at
        normal size, and is the single biggest difference between a shape that
        looks drawn and one that looks plotted.
        """
        src = bytes(self.px)
        for y in range(self.h):
            for x in range(self.w):
                idx = src[y * self.w + x]
                if idx not in ids:
                    continue
                empty = 0
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    xx, yy = x + dx, y + dy
                    if not (0 <= xx < self.w and 0 <= yy < self.h) or not src[yy * self.w + xx]:
                        empty += 1
                if empty >= corners:
                    pos = ids.index(idx)
                    self.put(x, y, ids[max(0, pos - 1)])

    def taper_line(self, x0, y0, x1, y1, near, far, bend=0.0):
        """A hair: one pixel wide, bright at the root and fading to nothing, with
        an optional bow in it. Straight two-pixel whiskers look like scratches."""
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 1.4) + 1
        for i in range(steps + 1):
            t = i / steps
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t + bend * (t - t * t) * 4.0
            self.put(x, y, near if t < 0.45 else far)

    def feather(self, x0, x1, y, upper, lower, depth=4, seed=1):
        """Interlocks two coats along a boundary.

        Fur does not end in a straight line. This walks the boundary putting
        tongues of the upper material down into the lower one and back, at
        heights that do not repeat, so the join reads as hair rather than as a
        shelf.
        """
        h = seed * 2654435761 & 0xFFFFFFFF
        for x in range(int(x0), int(x1) + 1):
            h = (h * 1103515245 + 12345) & 0x7FFFFFFF
            reach = (h >> 9) % (depth + 1)
            for d in range(reach):
                idx = self.get(x, y + d)
                if idx in lower:
                    pos = min(len(upper) - 1, max(0, len(upper) - 2 - d))
                    self.put(x, y + d, upper[pos])
            for d in range(depth - reach):
                idx = self.get(x, y - 1 - d)
                if idx in upper:
                    pos = min(len(lower) - 1, len(lower) - 2)
                    if (h >> (12 + d)) & 1:
                        self.put(x, y - 1 - d, lower[pos])

    def despeckle(self):
        """Clears lone pixels, which are the tell of a shape that was computed
        rather than drawn."""
        src = bytes(self.px)
        for y in range(self.h):
            for x in range(self.w):
                if not src[y * self.w + x]:
                    continue
                n = 0
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < self.w and 0 <= yy < self.h and src[yy * self.w + xx]:
                        n += 1
                if n == 0:
                    self.put(x, y, 0)

    def finish(self, rim=True):
        self.despeckle()
        if rim:
            self.rim_light()
        self.outline()
        return self

    def emit(self):
        return self, [rgb555(c) for c in self.pal]
