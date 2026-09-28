"""Act III's regions for the cell kit (env/kit.py): the Western Desert.

  white    the White Desert: chalk towers weathered into mushrooms and tents on pale sand, flint underfoot
  siwa     Siwa: the salt-and-mud kershef of old Shali in ruins, palm groves, spring pools, salt pans
  dunes    the Great Sand Sea: dune ridges for blocks, wind-rippled troughs for lanes, bleached bones
  futuh    Bab al-Futuh (Trial II): the gate's two square towers with their carved bosses, a courtyard of the jinn

Blocks south of a lane stay low (the camera looks north over them); blocks north of it may be tall.
"""
import math
from mathutils import Vector as V, Matrix

from qart.geom import TAU
from env.regions import Paint, post_lamp, face_points, frange, junction_corners


def rotz(a):
    return Matrix.Rotation(a, 4, 'Z')


def lumps(P, rnd, x0, y0, x1, y1, n, cols, z=0.0, s=(0.1, 0.35)):
    for k in range(n):
        px, py = rnd.uniform(x0, x1), rnd.uniform(y0, y1)
        r = rnd.uniform(*s)
        P(rnd.choice(cols)).box((px, py, z + r * 0.25), (r, r * 0.8, r * 0.5), rotz(rnd.uniform(0, 3)))


# ================================================================ the White Desert
class White:
    NAME, LANE = 'white', 6.4
    CHALK = ['#E8E2D2', '#DCD4C0', '#F0EADC', '#D2C8B2']

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#B8AC92').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#D6CBB0', rough=0.98).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            lumps(P, rnd, x0, y0, x1, y1, int((x1 - x0) * (y1 - y0) / 3), ['#3A342C', '#2E2A26', '#4A4034'], s=(0.05, 0.14))   # flint
        P.flush()

    @staticmethod
    def formation(P, rnd, x, y, h, r):
        """A chalk tower worn into a mushroom: a narrow neck under a wide cap, streaked and pitted."""
        neck = r * rnd.uniform(0.45, 0.6)
        P(rnd.choice(White.CHALK), flat=False).sloft([(V((x, y, z)), V((1, 0, 0)), V((0, 1, 0)), rr, rr * rnd.uniform(0.8, 1.1))
                                                      for z, rr in ((0, r * 1.05), (h * 0.25, r * 0.8), (h * 0.55, neck), (h * 0.8, neck * 1.05),
                                                                    (h * 0.92, r * 1.1), (h, r * 0.9))], seg=12, p=2.2)
        P('#C8BEA6', flat=False).sphere((x, y, h), (r * 0.9, r * 0.85, r * 0.3), seg=10)

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        P('#C8BEA6').box((cx, cy, 0.35), (w, d, 0.7))   # a low shelf of chalk the formations stand on
        n = 1 if low else max(1, int(w * d / 9))
        for k in range(n):
            x, y = rnd.uniform(x0 + 1.0, x1 - 1.0) if w > 2 else cx, rnd.uniform(y0 + 1.0, y1 - 1.0) if d > 2 else cy
            r = min(w, d) * rnd.uniform(0.2, 0.32)
            White.formation(P, rnd, x, y, rnd.uniform(1.4, 2.0) if low else rnd.uniform(3.5, 6.5), r)
        lumps(P, rnd, x0, y0, x1, y1, 6, White.CHALK, z=0.7, s=(0.2, 0.6))
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal' and rnd.random() < 0.6:
            (x, y) = rnd.choice(junction_corners(lanes, 0.8))
            # the ashes of a travellers' fire in a ring of stones, still glowing
            for k in range(7):
                a = TAU * k / 7
                P('#8A8070').box((x + 0.45 * math.cos(a), y + 0.45 * math.sin(a), 0.08), (0.18, 0.14, 0.16), rotz(a))
            P('#FF7A30', rough=0.5, emit=0.8, flat=False).sphere((x, y, 0.05), (0.28, 0.28, 0.06), seg=8)
            ctx.light((x, y, 0.8), 6.0, (14.0, 7.0, 2.4))
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        # the jeep track comes in, and a stalled 4x4 with its lamps still on
        for sx in (-1.2, 1.2):
            P('#BCAE92').box((sx, -6.0, 0.02), (0.4, 4.0, 0.02))
        P('#6A5A42', rough=0.6, metal=0.2).box((-2.4, -6.4, 0.9), (1.8, 4.0, 1.2))
        P('#4A4034', rough=0.6).box((-2.4, -6.8, 1.75), (1.7, 2.4, 0.6))
        P('#FFE8B0', rough=0.3, emit=0.8).box((-2.4, -4.38, 0.9), (1.2, 0.05, 0.2))
        ctx.solid(-2.4, -6.4, 0.9, 2.0)
        ctx.light((-2.4, -3.2, 1.0), 9.0, (16.0, 14.0, 9.0))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # a ring of the tallest formations round a hollow of sand; the northern one crowned like a head
        for k in range(8):
            a = TAU * k / 8 + 0.2
            x, y = math.cos(a) * 6.0, math.sin(a) * 6.0
            if y < -4.0 and abs(x) < 3.0:
                continue
            White.formation(P, rnd, x, y, rnd.uniform(4.0, 7.0), rnd.uniform(0.7, 1.0))
            ctx.solid(x, y, 0.8, 0.8)
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # the Chicken and the Mushroom: the two formations every traveller stops for (to the south: the way in is north)
        White.formation(P, rnd, -1.8, -3.6, 3.2, 1.3)
        P('#E8E2D2', flat=False).sloft([(V((1.8, -3.4, z)), V((1, 0, 0)), V((0, 1, 0)), r, r * 0.8)
                                        for z, r in ((0, 1.2), (1.2, 0.9), (2.2, 0.7), (2.6, 0.5))], seg=10)
        P('#E8E2D2', flat=False).sphere((2.2, -3.8, 2.8), (0.4, 0.6, 0.35), seg=8)
        ctx.solid(-1.8, -3.6, 1.3, 1.3)
        ctx.solid(1.8, -3.4, 1.2, 1.0)
        ctx.points['chest'] = [3.0, 1.0]
        P.flush()


# ================================================================ Siwa
class Siwa:
    NAME, LANE = 'siwa', 5.4
    KERSHEF = ['#B8A07A', '#A89068', '#C4AC86', '#9C8660']

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#8E7C5C').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#B8A47E', rough=0.98).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            for k in range(int((x1 - x0) * (y1 - y0) / 6)):   # crusts of salt
                px, py = rnd.uniform(x0 + 0.3, x1 - 0.3), rnd.uniform(y0 + 0.3, y1 - 0.3)
                P('#E8E4DA', rough=0.6).box((px, py, 0.025), (rnd.uniform(0.2, 0.6), rnd.uniform(0.15, 0.4), 0.01), rotz(rnd.uniform(0, 3)))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        if rnd.random() < 0.35:
            # a palm grove behind a low mud wall, a spring pool among the trees
            P('#3A4A26', rough=0.95).box((cx, cy, 0.25), (w - 0.3, d - 0.3, 0.5))
            if w > 3 and d > 3:
                P('#2A6A6E', rough=0.06, metal=0.3, emit=0.1).box((cx, cy, 0.52), (w * 0.4, d * 0.4, 0.02))
            from env.regions2 import palm
            for k in range(1 if low else rnd.randint(2, 4)):
                palm(P, rnd.uniform(x0 + 0.7, x1 - 0.7), rnd.uniform(y0 + 0.7, y1 - 0.7), 3.0 if low else rnd.uniform(5.0, 7.5), rnd)
            for s in sides:
                if s in ('N', 'S'):
                    P('#8E7650').box((cx, y1 - 0.15 if s == 'N' else y0 + 0.15, 0.6), (w, 0.3, 1.2))
                else:
                    P('#8E7650').box((x1 - 0.15 if s == 'E' else x0 + 0.15, cy, 0.6), (0.3, d, 1.2))
        else:
            # kershef: salt-clay walls melted by the one rain, stacked houses with palm-log lintels, some roofless
            h = rnd.uniform(2.2, 3.0) if low else rnd.uniform(4.0, 7.0)
            tiers = 1 if low else rnd.randint(2, 3)
            z = 0.0
            for t in range(tiers):
                hh = h / tiers
                k = 1.0 - 0.14 * t
                P(rnd.choice(Siwa.KERSHEF), flat=False).sloft([(V((cx + rnd.uniform(-0.2, 0.2) * t, cy, z + dz)), V((1, 0, 0)), V((0, 1, 0)),
                                                                w * k / 2 * (1 - 0.06 * dz / hh), d * k / 2 * (1 - 0.06 * dz / hh))
                                                               for dz in (0, hh * 0.5, hh)], seg=16, p=5.0)
                z += hh
            for s in sides:   # small dark doorways with palm-log lintels
                pts, n = face_points(x0, y0, x1, y1, s)
                horiz = s in ('N', 'S')
                for i, (px, py) in enumerate(pts):
                    if i % 2:
                        continue
                    P('#1A140E').box((px + n[0] * 0.04, py + n[1] * 0.04, 0.9), (0.9 if horiz else 0.08, 0.08 if horiz else 0.9, 1.8))
                    P('#5A4430', flat=False).capsule(V((px - (0.7 if horiz else 0), py - (0 if horiz else 0.7), 1.9)) + V((n[0] * 0.1, n[1] * 0.1, 0)),
                                                     V((px + (0.7 if horiz else 0), py + (0 if horiz else 0.7), 1.9)) + V((n[0] * 0.1, n[1] * 0.1, 0)),
                                                     0.08, seg=5)
                    if rnd.random() < 0.3:
                        P('#FFB060', rough=0.3, emit=0.9).box((px + n[0] * 0.3, py + n[1] * 0.3, 2.2), (0.14, 0.14, 0.2))
                        ctx.light((px + n[0] * 1.0, py + n[1] * 1.0, 2.0), 5.0, (11.0, 7.0, 3.0))
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal':
            for (x, y) in rnd.sample(junction_corners(lanes, 0.5), 1):
                # a heap of dates on a palm-frond mat
                P('#6A5A36').box((x, y, 0.02), (1.0, 0.8, 0.03))
                for k in range(14):
                    P('#5A2A16', flat=False).sphere((x + rnd.uniform(-0.3, 0.3), y + rnd.uniform(-0.25, 0.25), 0.06 + 0.02 * (k % 3)), 0.05, seg=5)
                ctx.solid(x, y, 0.5, 0.4)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        for sx in (-1, 1):   # the old town's gate, its jambs crumbled, a palm-log lintel still across
            P('#A89068').box((sx * (Siwa.LANE / 2 + 0.6), -7.0, 1.8), (1.2, 1.4, 3.6))
            ctx.solid(sx * (Siwa.LANE / 2 + 0.6), -7.0, 0.6, 0.7)
        P('#5A4430', flat=False).capsule(V((-Siwa.LANE / 2 - 1.0, -7.0, 3.7)), V((Siwa.LANE / 2 + 1.0, -7.0, 3.7)), 0.14, seg=6)
        post_lamp(P, ctx, Siwa.LANE / 2 - 0.4, -5.4, h=2.8, color='#FFB060', light=(12.0, 7.5, 3.0))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # the Spring of the Sun: a round stone pool of clear water, its steps going down, and the palms round it
        P('#9C8660').box((0, 4.0, 0.2), (7.0, 3.6, 0.4))
        P('#2A7A80', rough=0.05, metal=0.3, emit=0.15).box((0, 4.0, 0.42), (6.2, 2.8, 0.02))
        ctx.solid(0, 4.0, 3.5, 1.8)
        from env.regions2 import palm
        for (x, y) in ((-5.2, 4.2), (5.2, 4.4), (-5.6, -1.0), (5.4, 0.8)):
            palm(P, x, y, rnd.uniform(5.5, 7.0), rnd)
            ctx.solid(x, y, 0.3, 0.3)
        for x in (-3.0, 3.0):
            post_lamp(P, ctx, x, 1.8, h=2.8, color='#9FE8F0', light=(5.0, 11.0, 13.0))
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # the oracle's hill: a mound with the ruined temple's walls on it (to the south: the way in is north)
        P('#9C8660', flat=False).sloft([(V((0, -4.0, z)), V((1, 0, 0)), V((0, 1, 0)), r, r * 0.8) for z, r in ((0, 3.6), (1.2, 2.8), (2.0, 1.8))],
                                      seg=14)
        for (x, y, w, d) in ((-1.0, -4.0, 0.4, 2.4), (1.0, -4.0, 0.4, 2.4), (0, -5.0, 2.4, 0.4)):
            P('#C8B08A').box((x, y, 2.9), (w, d, 1.8))
        ctx.solid(0, -4.0, 3.2, 2.6)
        ctx.light((0, -1.4, 2.8), 9.0, (12.0, 9.0, 6.0))
        ctx.points['chest'] = [2.8, 0.6]
        P.flush()


# ================================================================ the Great Sand Sea
class Dunes:
    NAME, LANE = 'dunes', 6.8
    SAND = ['#D8A868', '#CC9C5C', '#E0B478', '#C8945A']

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#B8864E').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#C89A60', rough=0.98).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            # wind ripples: long low ridges across the trough
            horiz = (x1 - x0) >= (y1 - y0)
            if horiz:
                for x in frange(x0 + 0.3, x1 - 0.3, 0.45):
                    P('#D4A66C').box((x, (y0 + y1) / 2, 0.03), (0.08, y1 - y0 - 0.2, 0.03))
            else:
                for y in frange(y0 + 0.3, y1 - 0.3, 0.45):
                    P('#D4A66C').box(((x0 + x1) / 2, y, 0.03), (x1 - x0 - 0.2, 0.08, 0.03))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        # a dune: a long ridge with a sharp crest, one face steep (the slip face) and one gentle
        h = rnd.uniform(1.0, 1.6) if low else rnd.uniform(2.8, 5.0)
        along = w >= d
        L, W_ = (w, d) if along else (d, w)
        rows = []
        for i in range(9):
            f = i / 8
            u = (f - 0.5) * L
            crest = h * (1 - 0.35 * (2 * f - 1) ** 2)
            prof = [(-W_ / 2, 0.02), (-W_ * 0.15, crest * 0.8), (W_ * 0.05, crest), (W_ * 0.25, crest * 0.4), (W_ / 2, 0.02)]
            row = []
            for (v, z) in prof:
                p = V((u, v, z)) if along else V((v, u, z))
                row.append(p + V((cx, cy, 0)))
            rows.append(row)
        P(rnd.choice(Dunes.SAND), flat=False).grid(rows, closed=False)
        P('#B8864E').box((cx, cy, 0.01), (w, d, 0.02))
        if not low and rnd.random() < 0.3:   # the ribs of a camel, half buried
            bx, by = cx + rnd.uniform(-w / 4, w / 4), cy + rnd.uniform(-d / 4, d / 4)
            for k in range(6):
                P('#E8E0CC', flat=False).sweep([V((bx - 0.5 + k * 0.2, by - 0.3, 0.3)), V((bx - 0.5 + k * 0.2, by, 0.6)),
                                                V((bx - 0.5 + k * 0.2, by + 0.3, 0.3))], 0.03, seg=4)
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal' and rnd.random() < 0.5:
            (x, y) = rnd.choice(junction_corners(lanes, 0.7))
            # a survey marker from an old expedition: a painted oil drum with a pole
            P('#8A3A2A', rough=0.5, metal=0.5, flat=False).sloft([(V((x, y, z)), V((1, 0, 0)), V((0, 1, 0)), 0.3, 0.3) for z in (0, 0.9)], seg=10)
            P('#3A3A3C', metal=0.6).box((x, y, 1.6), (0.05, 0.05, 1.4))
            P('#E8D8B0', rough=0.8).box((x + 0.2, y, 2.1), (0.4, 0.02, 0.26))
            ctx.solid(x, y, 0.32, 0.32)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        # the last cairn before the sand sea, and a hurricane lamp hung on it
        P('#8A7A62').box((-(Dunes.LANE / 2 + 0.8), -6.6, 0.6), (1.2, 1.2, 1.2))
        P('#7A6A54').box((-(Dunes.LANE / 2 + 0.8), -6.6, 1.5), (0.8, 0.8, 0.6))
        P('#FFB060', rough=0.3, emit=0.9).box((-(Dunes.LANE / 2 + 0.2), -6.6, 1.4), (0.18, 0.18, 0.26))
        ctx.solid(-(Dunes.LANE / 2 + 0.8), -6.6, 0.6, 0.6)
        ctx.light((-(Dunes.LANE / 2 - 0.4), -6.6, 1.6), 8.0, (14.0, 8.5, 3.4))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # a bowl between star dunes, the half-buried stones of a lost caravan's camp in the middle
        for k in range(10):
            a = TAU * k / 10
            x, y = math.cos(a) * 6.2, math.sin(a) * 6.2
            if y < -4.0 and abs(x) < 3.2:
                continue
            P(rnd.choice(Dunes.SAND), flat=False).sphere((x, y, 0.2), (1.8, 1.4, 1.4), rotz(a), seg=10)
            ctx.solid(x, y, 1.2, 1.2)
        for k in range(5):
            a = TAU * k / 5
            P('#8A7A62').box((1.2 * math.cos(a), 2.4 + 1.2 * math.sin(a), 0.3), (0.6, 0.5, 0.6), rotz(a))
        P('#FF7A30', rough=0.5, emit=0.8, flat=False).sphere((0, 2.4, 0.1), (0.4, 0.4, 0.1), seg=8)
        ctx.light((0, 2.4, 1.2), 10.0, (18.0, 8.0, 2.4))
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # a sand-buried Land Rover of the old expeditions, only its roof and a door showing (to the south)
        P('#7A7A5A', rough=0.6, metal=0.3).box((0, -3.6, 0.5), (2.0, 3.8, 1.0), rotz(0.3))
        P('#C89A60', flat=False).sphere((0.6, -3.2, 0.1), (2.2, 2.6, 0.9), rotz(0.3), seg=10)
        ctx.solid(0, -3.6, 1.6, 2.0)
        ctx.points['chest'] = [2.6, 0.8]
        ctx.light((0, -1.2, 1.6), 7.0, (10.0, 8.0, 6.0))
        P.flush()


# ================================================================ Bab al-Futuh: the second trial
class Futuh:
    NAME, LANE = 'futuh', 6.0

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#2A241E').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#6A5E4E').box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            for x in frange(x0 + 0.6, x1 - 0.6, 1.2):
                for y in frange(y0 + 0.6, y1 - 0.6, 1.2):
                    if rnd.random() < 0.7:
                        P(rnd.choice(['#8A7E6A', '#7E7260', '#948874'])).box((x, y, 0.03), (1.14, 1.14, 0.03))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        h = rnd.uniform(3.0, 3.6) if low else rnd.uniform(6.5, 8.0)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        P('#B8A47E').box((cx, cy, h / 2), (w, d, h))
        P('#C8B48E').box((cx, cy, h + 0.15), (w + 0.2, d + 0.2, 0.3))
        for s in sides:   # carved bosses in rows, shields and arrow slits, torches of jinn-blue fire
            pts, n = face_points(x0, y0, x1, y1, s)
            horiz = s in ('N', 'S')
            for i, (px, py) in enumerate(pts):
                P('#C8B48E', flat=False).sphere((px + n[0] * 0.06, py + n[1] * 0.06, min(h - 0.8, 2.4)), (0.28, 0.28, 0.28), seg=8)
                P('#1A1410').box((px + n[0] * 0.04, py + n[1] * 0.04, min(h - 0.5, 3.6)), (0.16 if horiz else 0.08, 0.08 if horiz else 0.16, 0.9))
                if i % 2 == 1:
                    P('#2A2420', metal=0.5).box((px + n[0] * 0.3, py + n[1] * 0.3, 2.0), (0.12, 0.12, 0.5))
                    P('#5AB8FF', rough=0.4, emit=1.0, flat=False).sphere((px + n[0] * 0.3, py + n[1] * 0.3, 2.35), (0.12, 0.12, 0.18), seg=6)
                    ctx.light((px + n[0] * 0.9, py + n[1] * 0.9, 2.2), 5.0, (5.0, 9.0, 16.0))
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        pass

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        # the gate: two square towers with rounded fronts, carved bosses, the passage between under a lintel
        for sx in (-1, 1):
            x = sx * 4.6
            P('#B8A47E').box((x, -6.0, 3.6), (3.2, 3.2, 7.2))
            P('#C8B48E', flat=False).sloft([(V((x, -7.6, z)), V((1, 0, 0)), V((0, 1, 0)), 1.6, 0.8) for z in (0.0, 7.2)], seg=16, a0=math.pi,
                                          a1=TAU, closed=False)
            for z in (2.4, 4.4):
                P('#D8C49E', flat=False).sphere((x, -8.2, z), (0.4, 0.3, 0.4), seg=8)
            ctx.solid(x, -6.4, 1.6, 1.6)
        P('#B8A47E').box((0, -6.0, 6.2), (6.0, 2.4, 2.0))
        ctx.light((0, -4.4, 3.0), 8.0, (6.0, 10.0, 18.0))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # the gatekeeper's hall: suits of old Mamluk armour on stands round a sunken floor, blue fire in iron bowls
        for k in range(8):
            a = TAU * k / 8 + 0.2
            x, y = math.cos(a) * 5.6, math.sin(a) * 5.6
            if y < -4.5 and abs(x) < 3.0:
                continue
            P('#3A3430', metal=0.7).box((x, y, 0.9), (0.5, 0.5, 1.8))
            P('#6A6E74', metal=0.9, rough=0.3, flat=False).sphere((x, y, 2.0), (0.22, 0.22, 0.3), seg=8)
            ctx.solid(x, y, 0.3, 0.3)
        for x in (-2.8, 2.8):
            P('#2A2420', metal=0.6, flat=False).sloft([(V((x, 4.4, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((0, 0.4), (0.8, 0.3), (1.0, 0.55))],
                                                      seg=10)
            P('#5AB8FF', rough=0.5, emit=1.0, flat=False).sphere((x, 4.4, 1.15), (0.45, 0.45, 0.3), seg=8)
            ctx.light((x, 4.4, 1.8), 10.0, (6.0, 12.0, 22.0))
            ctx.solid(x, 4.4, 0.45, 0.45)
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        Futuh.arena(m, rnd, ctx)
        ctx.points['chest'] = [3.0, -2.0]


REGIONS = [White, Siwa, Dunes, Futuh]
