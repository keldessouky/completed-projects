"""The drawing toolkit the cast is built with.

Shapes go down first, in ramps that are lit from the upper left. Two passes
afterwards do most of the work of making the result look drawn rather than
assembled: a cool rim light along the lower-right edge, and an outline that
takes its colour from whatever material it is wrapping instead of being a flat
black key line.
"""
import math

#  A sprite's colour budget. Not a hardware number: the DS stores colour in a
#  16-bit halfword of which 15 bits are colour, and this game draws into a
#  direct framebuffer, so any of the 32,768 are available per pixel. This is a
#  budget for keeping palettes tidy and the ROM small.
PALETTE_LIMIT = 64

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
            # Tongues of the lower coat coming up have to start at the boundary
            # and stay joined to it. Scattering them by chance leaves isolated
            # pixels in the middle of the other coat, which read as dirt.
            climb = (h >> 17) % (depth - reach + 1) if depth > reach else 0
            for d in range(climb):
                below = self.get(x, y - d)
                if below not in lower and d:
                    break
                idx = self.get(x, y - 1 - d)
                if idx not in upper:
                    break
                self.put(x, y - 1 - d, lower[min(len(lower) - 1, len(lower) - 2)])

    def shade_form(self, cx, cy, rx, ry, shift=-1, soft=1):
        """Steps everything inside an ellipse along its own ramp.

        This is how a sprite gets occlusion — under a chin, beneath a ruff,
        where a tail crosses a flank — without introducing new colours. The
        outer ring is dithered so the shadow has an edge that fur can live on.
        """
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                dx = (x - cx) / max(0.5, rx)
                dy = (y - cy) / max(0.5, ry)
                d2 = dx * dx + dy * dy
                if d2 > 1.0:
                    continue
                if soft and d2 > 0.62 and ((x + y) & 1):
                    continue                      # dithered edge
                idx = self.get(x, y)
                fam = self.family(idx)
                if not fam or idx not in fam:
                    continue
                pos = fam.index(idx)
                self.put(x, y, fam[max(0, min(len(fam) - 1, pos + shift))])

    def key_light(self, cx, cy, rx, ry, shift=1, soft=1):
        """The opposite: lifts the surfaces the key actually reaches."""
        self.shade_form(cx, cy, rx, ry, shift=shift, soft=soft)

    def relight(self, strength=0.55, depth=7.0, light=LIGHT, ambient=0.20):
        """Relights the whole sprite under one lamp.

        Stacking a dozen separately-shaded forms gives a dozen little lights and
        a flat result. This throws that away and derives a surface from the
        silhouette instead: a distance transform gives how far inside the shape
        each pixel is, its gradient gives which way the surface leans, and the
        distance itself stands in for how much the pixel faces the viewer. Every
        pixel is then moved toward the value that lamp implies, along its own
        material's ramp, so markings keep their identity while the whole
        character finally agrees about where the light is.
        """
        w, h = self.w, self.h
        far = 1e9
        dist = [0.0 if not self.px[i] else far for i in range(w * h)]
        for y in range(h):                                   # chamfer, forward
            for x in range(w):
                i = y * w + x
                if dist[i] == 0.0:
                    continue
                best = dist[i]
                if x: best = min(best, dist[i - 1] + 1.0)
                if y: best = min(best, dist[i - w] + 1.0)
                if x and y: best = min(best, dist[i - w - 1] + 1.4)
                if x + 1 < w and y: best = min(best, dist[i - w + 1] + 1.4)
                dist[i] = best
        for y in range(h - 1, -1, -1):                       # chamfer, backward
            for x in range(w - 1, -1, -1):
                i = y * w + x
                if dist[i] == 0.0:
                    continue
                best = dist[i]
                if x + 1 < w: best = min(best, dist[i + 1] + 1.0)
                if y + 1 < h: best = min(best, dist[i + w] + 1.0)
                if x + 1 < w and y + 1 < h: best = min(best, dist[i + w + 1] + 1.4)
                if x and y + 1 < h: best = min(best, dist[i + w - 1] + 1.4)
                dist[i] = best

        # The distance field alone says "deep interior faces the viewer", which
        # left to itself lights the whole middle of a large shape the same. The
        # second term is a plain sweep across the sprite's own bounds, from the
        # corner the key is in to the one opposite: that is what gives a big
        # form a lit side and a shadow side.
        xs = [i % w for i in range(w * h) if self.px[i]]
        ys = [i // w for i in range(w * h) if self.px[i]]
        if not xs:
            return
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        hx = max(1.0, (x1 - x0) / 2.0)
        hy = max(1.0, (y1 - y0) / 2.0)
        cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0

        out = bytearray(self.px)
        for y in range(h):
            for x in range(w):
                i = y * w + x
                idx = self.px[i]
                if not idx:
                    continue
                fam = self.family(idx)
                if not fam or idx not in fam:
                    continue
                gx = (dist[i + 1] if x + 1 < w else 0.0) - (dist[i - 1] if x else 0.0)
                gy = (dist[i + w] if y + 1 < h else 0.0) - (dist[i - w] if y else 0.0)
                mag = math.hypot(gx, gy)
                if mag > 0.001:
                    nx, ny = gx / mag, gy / mag          # points inward, uphill
                else:
                    nx = ny = 0.0
                nz = min(1.0, dist[i] / depth)
                flat = nz * nz                           # deep interior faces us
                nx *= (1.0 - flat)
                ny *= (1.0 - flat)
                lam = nx * light[0] + ny * light[1] + nz * light[2]
                u = (x - cx) / hx
                v = (y - cy) / hy
                sweep = 0.5 - (u * -light[0] + v * -light[1]) * 0.62
                lam = lam * 0.45 + max(0.0, min(1.0, sweep)) * 0.55
                target = ambient + (1.0 - ambient) * max(0.0, min(1.0, lam))
                here = fam.index(idx) / (len(fam) - 1)
                mixed = here + (target - here) * strength
                pos = int(round(max(0.0, min(1.0, mixed)) * (len(fam) - 1)))
                out[i] = fam[pos]
        self.px = out

    def stroke_shade(self, x0, y0, x1, y1, shift=1, bend=0.0, skip=0, only=None):
        """A fur stroke that steps whatever it lands on along that pixel's own
        ramp, instead of painting a fixed colour.

        After a relight, a stroke drawn at a fixed value is a value jump — it
        reads as dirt. Stepping the pixel that is already there keeps every
        stroke consistent with the light that was just established.
        """
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 1.3) + 1
        for i in range(steps + 1):
            if skip and i % (skip + 1):
                continue
            t = i / steps
            x = int(x0 + (x1 - x0) * t)
            y = int(y0 + (y1 - y0) * t + bend * (t - t * t) * 4.0)
            idx = self.get(x, y)
            fam = self.family(idx)
            if not fam or idx not in fam:
                continue
            pos = fam.index(idx)
            self.put(x, y, fam[max(0, min(len(fam) - 1, pos + shift))])

    def antialias_outline(self, samples=2):
        """Blends the key line into what it wraps.

        A hard one-pixel outline is a 16-bit convention. Mixing each outline
        pixel part-way toward the fill it touches — a real colour, not a
        dither — is what makes a 32-bit-era sprite's edge look drawn with a
        brush rather than stamped.
        """
        src = bytes(self.px)
        outlines = set(self.outline_of.values())
        for y in range(self.h):
            for x in range(self.w):
                idx = src[y * self.w + x]
                if idx not in outlines:
                    continue
                neighbours = []
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (1, -1), (-1, 1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < self.w and 0 <= yy < self.h:
                        n = src[yy * self.w + xx]
                        if n and n not in outlines:
                            neighbours.append(self.pal[n])
                if len(neighbours) < samples:
                    continue
                r = sum(c[0] for c in neighbours) / len(neighbours)
                g = sum(c[1] for c in neighbours) / len(neighbours)
                b = sum(c[2] for c in neighbours) / len(neighbours)
                base = self.pal[idx]
                # Weak on purpose. Blending the key line too far toward the fill
                # buys smoothness at three times zoom and loses the silhouette
                # at one, which is the size the handheld actually draws.
                t = 0.26 if len(neighbours) >= 4 else 0.15
                self.put(x, y, self.ink((base[0] + (r - base[0]) * t,
                                         base[1] + (g - base[1]) * t,
                                         base[2] + (b - base[2]) * t)))

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

    def quantise(self, limit=PALETTE_LIMIT):
        """Fit the palette into `limit` entries, transparency included.

        This used to cap at sixteen, on the reasoning that pret's Emerald and
        HeartGold sprites are all sixteen colours and the discipline is most of
        why they read as drawn. Half of that is right and half of it was cargo
        cult: sixteen is a *hardware* limit on a GBA-era 4bpp sprite, and this
        game does not have it. Both screens are direct framebuffers, so every
        pixel is an independent fifteen-bit value.

        What the discipline is actually worth is that a step has to be a
        decision rather than a gradient -- and that is a property of how far
        apart the steps are, not of how many there are. A bigger budget spent
        on more *materials*, each with its own outline and its own rim, reads
        richer. The same budget spent on more steps of the same plastic reads
        airbrushed, which is the thing this project got told off for once
        already and is not going back to.

        So the cap is generous now and this only collapses genuine
        near-duplicates, cheapest pair first. Cost is perceptual distance
        weighted by how much of the sprite is at stake, so a two-pixel
        highlight loses to a body tone rather than the reverse, and the
        survivor keeps its exact colour -- averaging the pair back together
        would put the soft edge straight back.
        """
        counts = {}
        for v in self.px:
            if v:
                counts[v] = counts.get(v, 0) + 1
        live = sorted(counts)

        def dist(a, b):
            ca, cb = self.pal[a], self.pal[b]
            dr, dg, db = ca[0] - cb[0], ca[1] - cb[1], ca[2] - cb[2]
            return 2 * dr * dr + 4 * dg * dg + 3 * db * db

        merged = {}
        while len(live) > limit - 1:
            best = None
            for i in range(len(live)):
                for j in range(i + 1, len(live)):
                    a, b = live[i], live[j]
                    cost = dist(a, b) * min(counts[a], counts[b])
                    if best is None or cost < best[0]:
                        best = (cost, a, b)
            _, a, b = best
            keep, drop = (a, b) if counts[a] >= counts[b] else (b, a)
            counts[keep] += counts[drop]
            del counts[drop]
            merged[drop] = keep
            live.remove(drop)

        def resolve(i):
            while i in merged:
                i = merged[i]
            return i

        # Compact what is left, so the palette has no holes and no dead entries.
        slot = {old: new for new, old in enumerate(live, start=1)}
        pal = [(0, 0, 0)] + [self.pal[i] for i in live]
        for n, v in enumerate(self.px):
            self.px[n] = slot[resolve(v)] if v else 0
        self.pal = pal
        return self

    def stage(self, w=64, h=64, ground=59, shadow=True):
        """Re-canvas onto the standard character frame and put the figure on
        the floor.

        The reference this game's art is drawn to puts a character on a 64x64
        canvas, centred, with its feet on row 59 and a shadow under them. That
        last part is the one that matters: without it a sprite is a cut-out
        pasted on a background, and the whole cast used to hover. Every
        battler standing on the same row is also what stops a party looking
        like four people photographed separately.

        Nothing is scaled. The drawings are already the right size -- Carl is
        thirty-four by fifty-seven -- so this moves them, it does not resample
        them, and no pixel an artist placed is touched.
        """
        xs = [i % self.w for i, v in enumerate(self.px) if v]
        ys = [i // self.w for i, v in enumerate(self.px) if v]
        if not xs:
            return self
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        #  `ground=None` means "stay where you are and just take a shadow",
        #  which is what the bestiary wants: those are drawn to fill their own
        #  canvas and moving them would crop something.
        if ground is None:
            ground = y1
            dx = dy = 0
        else:
            dx = (w - (x1 - x0 + 1)) // 2 - x0
            dy = ground - y1

        out = Sprite(w, h)
        out.pal = list(self.pal)
        out.outline_of = dict(self.outline_of)
        out.rim_of = dict(self.rim_of)

        if shadow:
            #  A dithered ellipse on the floor under the figure.
            #
            #  There is no alpha in this format, so the shadow is made out of
            #  holes: solid through the middle and a chequer at the rim, which
            #  lets the floor show through and is how every handheld before
            #  this one drew one. A solid ellipse reads as a sticker of a
            #  shadow; this reads as the floor being darker.
            from palettes import INK
            dark = out.ink(INK['ink'])
            rx = max(4, min(9, (x1 - x0 + 1) // 3))
            ry = 2
            cx, cy = (x0 + x1) // 2 + dx, ground + 2
            for j in range(-ry, ry + 1):
                span = 1.0 - (j / float(ry + 0.8)) ** 2
                half = int(rx * (span ** 0.5))
                for i in range(-half, half + 1):
                    soft = abs(i) > half - 2 or abs(j) == ry
                    if soft and ((i + j) & 1):
                        continue
                    out.put(cx + i, cy + j, dark)

        for y in range(self.h):
            for x in range(self.w):
                v = self.px[y * self.w + x]
                if v:
                    out.put(x + dx, y + dy, v)
        return out

    def emit(self):
        self.quantise()
        return self, [rgb555(c) for c in self.pal]
