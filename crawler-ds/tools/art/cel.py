"""A cel painter for the battle cast.

The look being drawn to is the handheld RPG battler and the farm-sim portrait:
flat areas of colour, a hard edge where the shadow starts, a line of light on
the edge that faces the lamp, darker lines where one part sits over another,
and a dark outline round the whole silhouette. No gradients and no normals --
the roundness is in where the shadow's edge falls.

Every part is a mask. A part's shadow is the part minus a copy of itself
nudged toward the light, which leaves a crescent along the side facing away;
its highlight is the same trick run the other way, one pixel deep. Parts are
laid down in order, and wherever a later part borders an earlier one it draws
its own darkest tone along the seam, so an arm reads as in front of a body
rather than printed on it. The outline goes on last, round everything.

Faces are not painted: eyes and mouths are placed by hand, with `put` and
`stamp`, because at this size a face is a handful of decisions and a shape
generator makes all of them slightly wrong.
"""

import math

W, H = 64, 72


def ellipse(cx, cy, rx, ry):
    m = set()
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            if dx * dx + dy * dy <= 1.0:
                m.add((x, y))
    return m


def poly(points):
    m = set()
    ys = [p[1] for p in points]
    for y in range(int(min(ys)), int(max(ys)) + 1):
        yc = y + 0.5
        xs = []
        n = len(points)
        for i in range(n):
            (x0, y0), (x1, y1) = points[i], points[(i + 1) % n]
            if (y0 <= yc < y1) or (y1 <= yc < y0):
                xs.append(x0 + (yc - y0) * (x1 - x0) / (y1 - y0))
        xs.sort()
        for a, b in zip(xs[::2], xs[1::2]):
            for x in range(int(math.floor(a + 0.5)), int(math.floor(b + 0.5))):
                m.add((x, y))
    return m


def capsule(x0, y0, x1, y1, r0, r1=None):
    """A limb: a segment with rounded ends, tapering from r0 to r1."""
    r1 = r0 if r1 is None else r1
    m = set()
    lx, ly = x1 - x0, y1 - y0
    L2 = lx * lx + ly * ly or 1
    for y in range(int(min(y0, y1) - max(r0, r1)) - 1, int(max(y0, y1) + max(r0, r1)) + 2):
        for x in range(int(min(x0, x1) - max(r0, r1)) - 1, int(max(x0, x1) + max(r0, r1)) + 2):
            px, py = x + 0.5, y + 0.5
            t = max(0.0, min(1.0, ((px - x0) * lx + (py - y0) * ly) / L2))
            r = r0 + (r1 - r0) * t
            dx, dy = px - (x0 + lx * t), py - (y0 + ly * t)
            if dx * dx + dy * dy <= r * r:
                m.add((x, y))
    return m


def rect(x0, y0, x1, y1):
    return {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)}


def mirror(m, cx=W / 2):
    """The same mask reflected about a vertical line (default: the middle)."""
    return {(int(2 * cx - 1 - x), y) for x, y in m}


class Mat:
    """A material: highlight, base, shadow, and the dark it draws seams in."""

    def __init__(self, hi, base, shade, line):
        self.hi, self.base, self.shade, self.line = hi, base, shade, line


class Cel:
    """A figure drawn in the 64x72 design space and painted at scale `k`.

    Shapes are scaled before they are rasterised, not after, so a small
    battler is painted small -- its own outline, its own shadow edges --
    rather than being a big one with rows and columns thrown away. Shrinking
    finished pixel art by a fraction is what made the party look chewed in
    battle; this is how the handhelds got several sizes of one character."""

    def __init__(self, outline=(0x26, 0x1d, 0x22), light=(-1, -1), k=1.0):
        self.k = k
        self.w, self.h = int(round(W * k)), int(round(H * k)) + 1
        self.col = {}          # (x, y) -> rgb
        self.part = {}         # (x, y) -> part number
        self.n = 0
        self.outline = outline
        self.lx, self.ly = light

    # -- shapes in design coordinates, rasterised at this figure's scale -----
    def X(self, v):
        return v * self.k

    def at(self, x, y):
        return int(round(x * self.k)), int(round(y * self.k))

    def ellipse(self, cx, cy, rx, ry):
        return ellipse(cx * self.k, cy * self.k, rx * self.k, ry * self.k)

    def poly(self, points):
        return poly([(x * self.k, y * self.k) for x, y in points])

    def capsule(self, x0, y0, x1, y1, r0, r1=None):
        return capsule(x0 * self.k, y0 * self.k, x1 * self.k, y1 * self.k, r0 * self.k,
                       None if r1 is None else r1 * self.k)

    def fluff(self, cx, cy, rx, ry, n=14, size=2.6, a0=0.0, a1=360.0, jitter=0.35):
        """An ellipse with tufts of fur standing out round its edge, between
        angles a0 and a1 (degrees, 0 = right, 90 = down). A smooth ellipse is
        a ball; the same ellipse with its outline broken into tufts is a cat
        that needs brushing."""
        m = self.ellipse(cx, cy, rx, ry)
        span = (a1 - a0) % 360 or 360
        for i in range(n):
            t = a0 + span * (i + 0.5) / n
            wob = 1.0 + jitter * (((i * 7919) % 5) / 4.0 - 0.5)
            a = math.radians(t)
            ox, oy = math.cos(a), math.sin(a)
            # base on the rim, tip pushed out and swept slightly clockwise
            bx, by = cx + ox * rx * 0.86, cy + oy * ry * 0.86
            tx = cx + ox * (rx + size * wob) - oy * size * 0.45
            ty = cy + oy * (ry + size * wob) + ox * size * 0.45
            w = size * 0.9
            m |= self.poly([(bx - oy * w, by + ox * w), (tx, ty), (bx + oy * w, by - ox * w)])
        return m

    def rect(self, x0, y0, x1, y1):
        a, b = self.at(x0, y0)
        c, d = self.at(x1, y1)
        return rect(a, b, c, d)

    def mirror(self, m):
        return mirror(m, W * self.k / 2)

    def size(self, small, mid, large):
        """One of three hand-drawn variants of a feature, by scale: a face is
        placed by hand, so it is drawn by hand for each size."""
        return small if self.k < 0.9 else large if self.k > 1.2 else mid

    def paint(self, mask, mat, shade=2, hi=1, seam=True, clip=None,
              seam_dirs=((1, 0), (-1, 0), (0, 1), (0, -1))):
        #  Shadow and light depths are in design pixels too.
        if shade:
            shade = max(1, int(round(shade * self.k)))
        """Lay a part down. `shade` is how deep its shadow crescent is, `hi`
        the depth of the lit edge (0 for none); `clip` limits it to a mask,
        so a shirt can be painted only where the jacket leaves it showing."""
        self.n += 1
        me = self.n
        if clip is not None:
            mask = mask & clip
        for (x, y) in mask:
            if not (0 <= x < self.w and 0 <= y < self.h):
                continue
            c = mat.base
            if shade and (x - self.lx * shade, y - self.ly * shade) not in mask:
                c = mat.shade
            elif hi and (x + self.lx * hi, y + self.ly * hi) not in mask:
                c = mat.hi
            #  `seam_dirs` narrows which neighbours count: a lock of hair two
            #  pixels wide is all seam if its sides count, so hair seams only
            #  along its underside.
            if seam:
                for dx, dy in seam_dirs:
                    q = (x + dx, y + dy)
                    if q not in mask and q in self.part:
                        c = mat.line
                        break
            self.col[(x, y)] = c
            self.part[(x, y)] = me
        return mask

    def put(self, x, y, rgb):
        self.col[(x, y)] = rgb
        self.part.setdefault((x, y), 0)

    def stamp(self, x0, y0, rows, key, scaled=True):
        """Hand-placed pixels: rows of characters, '.' left alone. The anchor
        is in design coordinates; the pixels are pixels."""
        if scaled:
            x0, y0 = self.at(x0, y0)
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != '.':
                    self.put(x0 + i, y0 + j, key[ch])

    def erase(self, mask):
        for p in mask:
            self.col.pop(p, None)
            self.part.pop(p, None)

    def finish(self):
        """The outline: every empty pixel that touches the figure along an
        edge. Corners are left open, which is what keeps curves round rather
        than stepped."""
        edge = set()
        for (x, y) in self.col:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q not in self.col and 0 <= q[0] < self.w and 0 <= q[1] < self.h:
                    edge.add(q)
        for q in edge:
            self.col[q] = self.outline
        return self

    def sprite(self):
        from forge_tools import Sprite
        s = Sprite(self.w, self.h)
        for (x, y), rgb in self.col.items():
            if 0 <= x < self.w and 0 <= y < self.h:
                s.px[y * self.w + x] = s.ink(rgb)
        return s
