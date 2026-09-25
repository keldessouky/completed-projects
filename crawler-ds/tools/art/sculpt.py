"""A sculptor for the bosses: shapes with depth, lit, then brought down to pixels.

Carl and Donut are taken from painted reference art, and that is the standard
the rest of the cast is held to: form turned by light, not flat areas of
colour with a shadow edge. Nothing like that exists for the bosses, so this
builds the painting instead of importing one.

A boss is a relief. Every part is a set of rounded primitives -- spheres,
limbs that taper, slabs with a bevel -- and each knows its own height and
surface normal at every point it covers, analytically, so nothing is guessed
from pixels. The parts of one piece of anatomy melt into each other with a
smooth maximum (a forearm into a fist, a gut into a chest); separate pieces
simply stack, and the higher one wins. That gives three things a flat drawing
does not have:

  * light that wraps round a form, warm from the key above and left and cool
    in the shadow, with a specular glint on anything wet;
  * shadows cast by one part across another -- an arm across a belly, a
    tentacle over its neighbour -- from marching toward the light through the
    height field;
  * dark creases wherever one surface drops under another, which is the line
    a painter puts at an overlap.

It is drawn four times over and averaged down, then quantised and outlined
exactly as import_ref.py does the reference art, so a boss comes out of the
same pipeline as the party it fights. Faces are placed by hand at the final
size, for the same reason Donut's are: at sixty pixels a face is a handful of
decisions.

Needs Pillow. The build does not: boss_paint.py writes what this makes to
boss_ref.py, which is committed.
"""

import math
import random

OUTLINE = (0x1c, 0x12, 0x10)


def _norm(x, y, z):
    d = math.sqrt(x * x + y * y + z * z) or 1.0
    return x / d, y / d, z / d


# ------------------------------------------------------------------ noise ---

class Noise:
    """Smooth value noise. `fbm` stacks octaves of it: mottled skin, grime,
    the grain in a pile of rubbish."""

    def __init__(self, seed=1):
        r = random.Random(seed)
        self.p = [r.random() for _ in range(256)]
        self.perm = list(range(256))
        r.shuffle(self.perm)

    def _h(self, i, j):
        return self.p[self.perm[(self.perm[i & 255] + j) & 255]]

    def at(self, x, y):
        i, j = math.floor(x), math.floor(y)
        fx, fy = x - i, y - j
        fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
        a, b = self._h(i, j), self._h(i + 1, j)
        c, d = self._h(i, j + 1), self._h(i + 1, j + 1)
        return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy

    def fbm(self, x, y, octaves=3):
        v, amp, tot = 0.0, 1.0, 0.0
        for _ in range(octaves):
            v += self.at(x, y) * amp
            tot += amp
            x, y, amp = x * 2.03 + 17.1, y * 2.03 + 9.7, amp * 0.5
        return v / tot


# ------------------------------------------------------------- primitives ---
#
#  Each takes design coordinates -- one unit is one pixel of the finished
#  sprite -- and answers, for a point, its height and its normal, or None if
#  the point is off it. `z` lifts a primitive toward the viewer; `flat`
#  squashes its depth, so a limb can be an oval in section instead of a tube.

class Ellipsoid:
    def __init__(self, cx, cy, rx, ry, rz=None, z=0.0):
        self.cx, self.cy, self.rx, self.ry = cx, cy, rx, ry
        self.rz = min(rx, ry) if rz is None else rz
        self.z = z

    def bbox(self):
        return self.cx - self.rx, self.cy - self.ry, self.cx + self.rx, self.cy + self.ry

    def eval(self, x, y):
        dx, dy = (x - self.cx) / self.rx, (y - self.cy) / self.ry
        d2 = dx * dx + dy * dy
        if d2 >= 1.0:
            return None
        s = math.sqrt(1.0 - d2)
        return (self.z + self.rz * s,
                self.rz * dx / self.rx, self.rz * dy / self.ry, s)


def Sphere(cx, cy, r, z=0.0):
    return Ellipsoid(cx, cy, r, r, r, z)


class Limb:
    """A tapering capsule from (x0, y0) to (x1, y1), radius r0 to r1, its
    axis rising from z0 to z1."""

    def __init__(self, x0, y0, x1, y1, r0, r1=None, z0=0.0, z1=None, flat=1.0):
        self.a = (x0, y0)
        self.b = (x1, y1)
        self.r0, self.r1 = r0, (r0 if r1 is None else r1)
        self.z0, self.z1 = z0, (z0 if z1 is None else z1)
        self.flat = flat
        self.lx, self.ly = x1 - x0, y1 - y0
        self.L2 = self.lx * self.lx + self.ly * self.ly or 1e-9

    def bbox(self):
        r = max(self.r0, self.r1)
        return (min(self.a[0], self.b[0]) - r, min(self.a[1], self.b[1]) - r,
                max(self.a[0], self.b[0]) + r, max(self.a[1], self.b[1]) + r)

    def eval(self, x, y):
        t = ((x - self.a[0]) * self.lx + (y - self.a[1]) * self.ly) / self.L2
        t = 0.0 if t < 0 else 1.0 if t > 1 else t
        cx, cy = self.a[0] + self.lx * t, self.a[1] + self.ly * t
        r = self.r0 + (self.r1 - self.r0) * t
        dx, dy = x - cx, y - cy
        d2 = dx * dx + dy * dy
        if d2 >= r * r:
            return None
        s = math.sqrt(r * r - d2)
        f = self.flat
        return (self.z0 + (self.z1 - self.z0) * t + s * f, f * dx, f * dy, s)


class Slab:
    """A flat shape with a rounded edge: cloth, a plank, a sign. `depth` is
    how far it stands up and `bevel` how wide the rounding is."""

    def __init__(self, points, depth=3.0, bevel=2.5, z=0.0):
        self.pts = points
        self.depth, self.bevel, self.z = depth, bevel, z
        self.edges = [(points[i], points[(i + 1) % len(points)]) for i in range(len(points))]

    def bbox(self):
        xs = [p[0] for p in self.pts]
        ys = [p[1] for p in self.pts]
        return min(xs), min(ys), max(xs), max(ys)

    def eval(self, x, y):
        inside = False
        best, bx, by = 1e18, 0.0, 0.0
        for (x0, y0), (x1, y1) in self.edges:
            if (y0 <= y < y1) or (y1 <= y < y0):
                if x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
                    inside = not inside
            ex, ey = x1 - x0, y1 - y0
            l2 = ex * ex + ey * ey or 1e-9
            t = ((x - x0) * ex + (y - y0) * ey) / l2
            t = 0.0 if t < 0 else 1.0 if t > 1 else t
            qx, qy = x0 + ex * t, y0 + ey * t
            d2 = (x - qx) ** 2 + (y - qy) ** 2
            if d2 < best:
                best, bx, by = d2, qx, qy
        if not inside:
            return None
        e = math.sqrt(best)
        t = min(e / self.bevel, 1.0)
        u = 1.0 - t
        s = math.sqrt(max(1e-6, 1.0 - u * u))
        h = self.z + self.depth * s
        if t >= 1.0 or e < 1e-6:
            return h, 0.0, 0.0, 1.0
        slope = self.depth * u / (self.bevel * s)
        ix, iy = (x - bx) / e, (y - by) / e
        return h, -slope * ix, -slope * iy, 1.0


# -------------------------------------------------------------- materials ---

class Mat:
    """What a surface is made of. `col` is its colour, or a function of the
    design point returning one; `spec` and `shine` its gloss; `bump` a
    function of the point returning a small height, for pores, scales and
    grime; `wrap` how far the light wraps round it (skin and fur wrap, a
    shell does not); `glow` that it gives its own light and is not lit at
    all -- fire, a pulse."""

    def __init__(self, col, spec=0.0, shine=18.0, bump=None, bump_k=1.0, wrap=0.25,
                 glow=None, accent=False):
        self.col, self.spec, self.shine = col, spec, shine
        self.bump, self.bump_k, self.wrap, self.glow = bump, bump_k, wrap, glow
        #  A small, bright part -- an eye, a lip, a jewel -- that the
        #  quantiser must not fold into the big surfaces round it.
        self.accent = accent

    def colour(self, x, y):
        return self.col(x, y) if callable(self.col) else self.col


# ------------------------------------------------------------------ scene ---

class Scene:
    """A boss being sculpted: `w` by `h` finished pixels, worked at `ss`
    times that."""

    def __init__(self, w, h, ss=4, light=(-0.55, -0.72, 0.52), seed=7):
        self.w, self.h, self.ss = w, h, ss
        self.W, self.H = w * ss, h * ss
        n = self.W * self.H
        self.z = [-1e9] * n
        self.nx = [0.0] * n
        self.ny = [0.0] * n
        self.nz = [1.0] * n
        self.mat = [None] * n
        self.part = [0] * n
        self.paint = {}           # idx -> rgb painted over the material
        self.parts = 0
        self.light = _norm(*light)
        self.noise = Noise(seed)
        self.stamps = []

    # -- building -------------------------------------------------------------
    def add(self, mat, prims, blend=1.5, z=0.0, clip=None, under=False):
        """One piece of anatomy: its primitives melted together with a
        smooth maximum of width `blend`, then stood in the scene where it is
        higher than what is there. `clip(x, y)` can cut it. `under` lays it
        only where nothing is yet -- for a thing seen behind the rest."""
        self.parts += 1
        me = self.parts
        ss, W, H = self.ss, self.W, self.H
        buf = {}
        for p in prims:
            x0, y0, x1, y1 = p.bbox()
            i0, i1 = max(0, int(x0 * ss) - 1), min(W - 1, int(x1 * ss) + 1)
            j0, j1 = max(0, int(y0 * ss) - 1), min(H - 1, int(y1 * ss) + 1)
            for j in range(j0, j1 + 1):
                y = (j + 0.5) / ss
                row = j * W
                for i in range(i0, i1 + 1):
                    x = (i + 0.5) / ss
                    r = p.eval(x, y)
                    if r is None:
                        continue
                    d = math.sqrt(r[1] * r[1] + r[2] * r[2] + r[3] * r[3]) or 1.0
                    r = (r[0], r[1] / d, r[2] / d, r[3] / d)
                    idx = row + i
                    old = buf.get(idx)
                    if old is None:
                        buf[idx] = r
                        continue
                    a, b = old[0], r[0]
                    diff = a - b
                    if diff >= blend:
                        continue
                    if diff <= -blend:
                        buf[idx] = r
                        continue
                    w = 0.5 + 0.5 * diff / blend
                    hmax = max(a, b) + (blend - abs(diff)) ** 2 / (4.0 * blend)
                    buf[idx] = (hmax,
                                old[1] * w + r[1] * (1 - w),
                                old[2] * w + r[2] * (1 - w),
                                old[3] * w + r[3] * (1 - w))
        zz, mats = self.z, self.mat
        for idx, (h, nx, ny, nz) in buf.items():
            if clip is not None:
                x, y = ((idx % W) + 0.5) / ss, ((idx // W) + 0.5) / ss
                if not clip(x, y):
                    continue
            h += z
            if under:
                if mats[idx] is not None:
                    continue
            elif h <= zz[idx]:
                continue
            zz[idx] = h
            d = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
            self.nx[idx], self.ny[idx], self.nz[idx] = nx / d, ny / d, nz / d
            mats[idx] = mat
            self.part[idx] = me
            self.paint.pop(idx, None)
        return me

    def height_at(self, x, y):
        """The surface height at a design point, as built so far."""
        i, j = int(x * self.ss), int(y * self.ss)
        if 0 <= i < self.W and 0 <= j < self.H and self.mat[j * self.W + i] is not None:
            return self.z[j * self.W + i]
        return None

    def cords(self, mat, paths, r=0.55, lift=0.35):
        """Raised cords laid over whatever is already there, following its
        surface: veins, stitching, roots. Each path is a list of points; a
        segment whose ends are off the figure is dropped."""
        prims = []
        for path in paths:
            for (x0, y0), (x1, y1) in zip(path, path[1:]):
                h0, h1 = self.height_at(x0, y0), self.height_at(x1, y1)
                if h0 is None or h1 is None:
                    continue
                prims.append(Limb(x0, y0, x1, y1, r, r * 0.85, h0 + lift, h1 + lift))
        return self.add(mat, prims, blend=0.4)

    def decal(self, where, col, part=None):
        """Paint colour onto what is already there, without changing its
        shape: a pattern on cloth, a stripe of greasepaint, a stain. `where`
        is a function of the design point; `col` a colour or a function."""
        ss, W = self.ss, self.W
        for idx in range(W * self.H):
            if self.mat[idx] is None:
                continue
            if part is not None and self.part[idx] != part:
                continue
            x, y = ((idx % W) + 0.5) / ss, ((idx // W) + 0.5) / ss
            if where(x, y):
                self.paint[idx] = col(x, y) if callable(col) else col

    def stamp(self, x, y, rows, key):
        """Hand-placed pixels at the finished size, laid after quantising."""
        self.stamps.append((int(round(x)), int(round(y)), rows, key))

    # -- lighting -------------------------------------------------------------
    def _shade(self):
        ss, W, H = self.ss, self.W, self.H
        Lx, Ly, Lz = self.light
        hx, hy, hz = _norm(Lx, Ly, Lz + 1.0)
        lxy = math.hypot(Lx, Ly)
        sdx, sdy = Lx / lxy, Ly / lxy
        rise = Lz / lxy                          # height gained per unit toward the light
        zz, mat = self.z, self.mat
        covered = [i for i in range(W * H) if mat[i] is not None]
        floor_z = min(zz[i] for i in covered) if covered else 0.0

        #  Creases: how far a point sits below the surface around it. A box
        #  blur of the height field (empty space counting as the floor)
        #  minus the height itself.
        r = 2 * ss
        zf = [zz[i] if mat[i] is not None else floor_z for i in range(W * H)]
        integ = [0.0] * ((W + 1) * (H + 1))
        for j in range(H):
            acc = 0.0
            base, up = (j + 1) * (W + 1), j * (W + 1)
            for i in range(W):
                acc += zf[j * W + i]
                integ[base + i + 1] = integ[up + i + 1] + acc

        def boxmean(i, j):
            a0, a1 = max(0, i - r), min(W, i + r + 1)
            b0, b1 = max(0, j - r), min(H, j + r + 1)
            s = (integ[b1 * (W + 1) + a1] - integ[b0 * (W + 1) + a1]
                 - integ[b1 * (W + 1) + a0] + integ[b0 * (W + 1) + a0])
            return s / ((a1 - a0) * (b1 - b0))

        out = {}
        for idx in covered:
            i, j = idx % W, idx // W
            x, y = (i + 0.5) / ss, (j + 0.5) / ss
            m = mat[idx]
            nx, ny, nz = self.nx[idx], self.ny[idx], self.nz[idx]
            if m.bump is not None:
                e = 0.5
                b0 = m.bump(x, y)
                gx = (m.bump(x + e, y) - b0) / e * m.bump_k
                gy = (m.bump(x, y + e) - b0) / e * m.bump_k
                nx, ny, nz = _norm(nx - gx * nz, ny - gy * nz, nz)
            base = self.paint.get(idx) or m.colour(x, y)
            if m.glow is not None:
                out[idx] = base
                continue
            h = zz[idx]

            #  Cast shadow: walk toward the light and see how far anything
            #  stands in the way. Soft, by how much it clears the ray and how
            #  far off it is, so a shadow models the form it lands on instead
            #  of ruling a line across it.
            occl = 0.0
            t = 0.75
            while t < 28.0:
                qi = int((x + sdx * t) * ss)
                qj = int((y + sdy * t) * ss)
                if not (0 <= qi < W and 0 <= qj < H):
                    break
                q = qj * W + qi
                if mat[q] is not None:
                    o = (zz[q] - h - t * rise - 0.4) / 3.0
                    if o > 0:
                        o = min(1.0, o) * (1.0 - t / 36.0)
                        if o > occl:
                            occl = o
                            if o >= 0.95:
                                break
                t += 0.75
            lit = 1.0 - occl

            ndl = nx * Lx + ny * Ly + nz * Lz
            wrap = m.wrap
            diff = max(0.0, (ndl + wrap) / (1.0 + wrap)) * (0.35 + 0.65 * lit)
            crease = max(0.0, min(1.0, (boxmean(i, j) - h) / 5.0))
            ao = 1.0 - 0.55 * crease
            #  Sky from above, a warm bounce from the floor below.
            sky = 0.5 - 0.5 * ny
            amb_r = 0.22 * sky + 0.18 * (1 - sky)
            amb_g = 0.23 * sky + 0.13 * (1 - sky)
            amb_b = 0.34 * sky + 0.11 * (1 - sky)
            key_r, key_g, key_b = 1.12, 1.03, 0.86
            spec = 0.0
            if m.spec and lit > 0.3:
                ndh = max(0.0, nx * hx + ny * hy + nz * hz)
                spec = m.spec * ndh ** m.shine * 255.0 * lit
            #  A cool rim on the side away from the light, so the dark side
            #  of a form still separates from the dark behind it.
            rim = max(0.0, 1.0 - nz) ** 2.2 * max(0.0, nx * 0.8 - ny * 0.2) * 0.35
            rr = base[0] * (key_r * diff * 0.95 + amb_r) * ao + spec + 90 * rim
            gg = base[1] * (key_g * diff * 0.95 + amb_g) * ao + spec + 100 * rim
            bb = base[2] * (key_b * diff * 0.95 + amb_b) * ao + spec * 0.9 + 130 * rim
            out[idx] = (min(255.0, rr), min(255.0, gg), min(255.0, bb))

        #  The overlap line: a point just below a higher, different part goes
        #  dark, the way a painter rules the line where one thing sits on
        #  another.
        part = self.part
        for idx in covered:
            if mat[idx].glow is not None:
                continue
            i, j = idx % W, idx // W
            h, me = zz[idx], part[idx]
            for di, dj in ((ss, 0), (-ss, 0), (0, ss), (0, -ss), (ss // 2, 0), (-ss // 2, 0),
                           (0, ss // 2), (0, -ss // 2)):
                qi, qj = i + di, j + dj
                if 0 <= qi < W and 0 <= qj < H:
                    q = qj * W + qi
                    if mat[q] is not None and part[q] != me and zz[q] > h + 2.0:
                        c = out[idx]
                        out[idx] = (c[0] * 0.42, c[1] * 0.38, c[2] * 0.42)
                        break
        return out

    # -- finishing ------------------------------------------------------------
    def render(self, colours=46, edge=OUTLINE, contrast=1.0, sharpen=0.45, sat=1.0, accents=8):
        """Shade, shrink, quantise, face, outline. Returns (palette, rows)
        in import_ref's format."""
        from PIL import Image
        from import_ref import ALPHABET
        ss, W, w, h = self.ss, self.W, self.w, self.h
        shaded = self._shade()
        px = {}
        accent = set()
        for y in range(h):
            for x in range(w):
                n, r, g, b, acc = 0, 0.0, 0.0, 0.0, 0
                for j in range(y * ss, y * ss + ss):
                    for i in range(x * ss, x * ss + ss):
                        c = shaded.get(j * W + i)
                        if c is not None:
                            n += 1
                            r += c[0]
                            g += c[1]
                            b += c[2]
                            acc += self.mat[j * W + i].accent
                if n * 2 >= ss * ss:
                    px[(x, y)] = (r / n, g / n, b / n)
                    if acc * 2 >= n:
                        accent.add((x, y))
        #  Averaging four-by-four blocks softens every edge by half a pixel;
        #  an unsharp mask puts the crispness back that a painter's last
        #  pass at size would have.
        if sharpen:
            soft = {}
            for (x, y), c in px.items():
                acc, k = [0.0, 0.0, 0.0], 0
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        q = px.get((x + dx, y + dy))
                        if q is not None:
                            acc[0] += q[0]
                            acc[1] += q[1]
                            acc[2] += q[2]
                            k += 1
                soft[(x, y)] = (acc[0] / k, acc[1] / k, acc[2] / k)
            px = {p: tuple(c[i] + sharpen * (c[i] - soft[p][i]) for i in range(3))
                  for p, c in px.items()}
        if sat != 1.0:
            def saturate(c):
                g = (c[0] * 3 + c[1] * 6 + c[2]) / 10.0
                return tuple(g + (v - g) * sat for v in c)
            px = {p: saturate(c) for p, c in px.items()}
        if contrast != 1.0:
            mean = [sum(c[k] for c in px.values()) / len(px) for k in range(3)]
            px = {p: tuple(mean[k] + (c[k] - mean[k]) * contrast for k in range(3))
                  for p, c in px.items()}
        #  Quantised in two groups, as import_ref does the party, so the few
        #  accent pixels are not outvoted by forty shades of skin.
        img = {}
        groups = [(sorted(p for p in px if p not in accent), colours - (accents if accent else 0)),
                  (sorted(accent), accents)]
        for pts, k_colours in groups:
            if not pts:
                continue
            strip = Image.new('RGB', (len(pts), 1))
            for k, p in enumerate(pts):
                c = px[p]
                strip.putpixel((k, 0), tuple(max(0, min(255, int(round(v)))) for v in c))
            q = strip.quantize(colors=min(k_colours, len(pts)), method=Image.Quantize.MEDIANCUT,
                               dither=Image.Dither.NONE).convert('RGB')
            img.update({p: q.getpixel((k, 0)) for k, p in enumerate(pts)})
        for sx, sy, rows, key in self.stamps:
            for j, row in enumerate(rows):
                for i, ch in enumerate(row):
                    if ch != '.':
                        img[(sx + i, sy + j)] = key[ch]
        #  One pixel of outline round the lot, on a canvas one pixel bigger
        #  each side, as import_ref does the party.
        out = {(x + 1, y + 1): c for (x, y), c in img.items()}
        for (x, y) in list(out):
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                p = (x + dx, y + dy)
                if p not in out:
                    out[p] = edge
        pal = sorted(set(out.values()))
        assert len(pal) < len(ALPHABET), len(pal)
        rows = [''.join(ALPHABET[pal.index(out[(x, y)])] if (x, y) in out else '.'
                        for x in range(w + 2)) for y in range(h + 2)]
        return pal, rows
