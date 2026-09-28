"""Act II's regions for the cell kit (env/kit.py): the Nile to Luxor.

  nile     the Nile bank: towpaths of dark silt between the river and the cane, feluccas at their moorings, palms
  village  a village of Upper Egypt: mud brick and whitewash, blue doors, the tall pigeon towers
  karnak   the hypostyle hall at Karnak: papyrus columns in rows, fallen drums, the avenue of rams
  valley   the Valley of the Kings: pale cliffs in strata, tomb doors cut in them, the diggers' baskets
  tomb     a king's tomb below: corridors in painted plaster, a ceiling of yellow stars on blue

Blocks south of a lane stay low (the camera looks north over them); blocks north of it may be tall.
"""
import math
from mathutils import Vector as V, Matrix

from qart.geom import TAU
from env.regions import Paint, post_lamp, face_points, frange, junction_corners


def rotz(a):
    return Matrix.Rotation(a, 4, 'Z')


def palm(P, x, y, h, rnd):
    """A date palm: a ringed trunk leaning a little, a crown of drooping fronds and a cluster of dates."""
    lean = V((rnd.uniform(-0.25, 0.25), rnd.uniform(-0.25, 0.25), 0))
    pts = [V((x, y, 0)) + lean * (k / 5) ** 2 + V((0, 0, h * k / 5)) for k in range(6)]
    P('#6A5238', flat=False).sweep(pts, lambda t: 0.2 - 0.07 * t, seg=7)
    top = pts[-1]
    for k in range(9):
        a = TAU * k / 9 + rnd.uniform(-0.2, 0.2)
        d = V((math.cos(a), math.sin(a), 0))
        L = rnd.uniform(1.6, 2.2)
        fr = [top, top + d * L * 0.4 + V((0, 0, 0.35)), top + d * L * 0.8 + V((0, 0, 0.1)), top + d * L + V((0, 0, -0.45))]
        P(rnd.choice(['#3E5A2A', '#4A6630', '#36502A']), flat=False).sweep(fr, lambda t: (0.03, 0.26 * math.sin(math.pi * min(1, t * 1.1)) + 0.02),
                                                                            seg=4, hint=V((0, 0, 1)))
    P('#8A4A20', flat=False).sphere(top + V((0.12, 0.1, -0.25)), (0.16, 0.16, 0.24), seg=8)


# ================================================================ the Nile bank
class Nile:
    NAME, LANE = 'nile', 6.6
    SILT = ['#5E4C36', '#54432F', '#665238']

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#3E3426').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#7A6448', rough=0.98).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            for k in range(int((x1 - x0) * (y1 - y0) / 5)):   # hoof prints and puddles on the towpath
                px, py = rnd.uniform(x0 + 0.3, x1 - 0.3), rnd.uniform(y0 + 0.3, y1 - 0.3)
                s = rnd.uniform(0.3, 0.9)
                if rnd.random() < 0.25:
                    P('#26404A', rough=0.1, metal=0.3).box((px, py, 0.025), (s, s * 0.7, 0.01), rotz(rnd.uniform(0, 3)))
                else:
                    P(rnd.choice(Nile.SILT)).box((px, py, 0.025), (s, s * 0.6, 0.02), rotz(rnd.uniform(0, 3)))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        if rnd.random() < 0.55:
            # the river: dark water a hand below the bank, a lip of silt round it, reeds at the edge
            P('#2A5C6E', rough=0.06, metal=0.3, emit=0.12).box((cx, cy, 0.03), (w - 0.5, d - 0.5, 0.02))   # (above the ground's top at 0)
            for k in range(int(w * d / 2)):   # moonlight on the ripples
                px, py = rnd.uniform(x0 + 0.5, x1 - 0.5), rnd.uniform(y0 + 0.5, y1 - 0.5)
                P('#B8E0EC', rough=0.2, emit=0.3).box((px, py, 0.043), (rnd.uniform(0.3, 0.9), 0.03, 0.005))
            for (ax, ay, bx, by) in ((x0, y0, x1, y0 + 0.3), (x0, y1 - 0.3, x1, y1), (x0, y0, x0 + 0.3, y1), (x1 - 0.3, y0, x1, y1)):
                P('#4A3C2A').box(((ax + bx) / 2, (ay + by) / 2, 0.12), (bx - ax, by - ay, 0.24))
            for s in sides:
                pts, n = face_points(x0, y0, x1, y1, s)
                for (px, py) in pts:
                    for k in range(5):
                        q = V((px - n[0] * 0.5 + rnd.uniform(-0.6, 0.6) * abs(n[1]), py - n[1] * 0.5 + rnd.uniform(-0.6, 0.6) * abs(n[0]), 0))
                        hh = rnd.uniform(0.8, 1.6)
                        P('#5A6A34', flat=False).capsule(q, q + V((rnd.uniform(-0.15, 0.15), rnd.uniform(-0.15, 0.15), hh)), 0.03, 0.008, seg=4)
                        P('#7A6A3A', flat=False).sphere(q + V((0, 0, hh)), (0.05, 0.05, 0.12), seg=5)
            if w > 3.2 and d > 2.4:   # a felucca at her mooring, sail furled on the long yard
                along = w >= d
                L = min(max(w, d) - 1.0, 5.0)
                rot = rotz(0 if along else math.pi / 2)
                hull = []
                for k in range(7):
                    f = k / 6
                    yy = (f - 0.5) * L
                    r = 0.42 * math.sin(math.pi * (0.08 + 0.84 * f)) ** 0.6
                    hull.append((rot @ V((0, yy, 0.12)) + V((cx, cy, 0)), rot @ V((1, 0, 0)), V((0, 0, 1)), r, 0.22))
                P('#5A3E28', rough=0.6, flat=False).sloft(hull, seg=10, p=3.0)   # a wooden hull, a blue stripe at the gunwale
                for sx in (-1, 1):   # the blue line along each side, under the gunwale
                    P('#2A5A8A', rough=0.6).box(rot @ V((sx * 0.4, 0, 0.26)) + V((cx, cy, 0)), (0.03, L * 0.7, 0.05), rot)
                mast = rot @ V((0, -L * 0.18, 0)) + V((cx, cy, 0))
                P('#4A3828', flat=False).capsule(mast, mast + V((0, 0, 5.0)), 0.045, 0.025, seg=6)
                y0v = rot @ V((0, -L * 0.6, 0.8)) + V((cx, cy, 0))
                y1v = rot @ V((0, L * 0.45, 5.8)) + V((cx, cy, 0))
                P('#4A3828', flat=False).capsule(y0v, y1v, 0.03, seg=6)
                P('#CFC6B0', rough=0.95, flat=False).capsule(y0v.lerp(y1v, 0.1), y0v.lerp(y1v, 0.85), 0.08, 0.05, seg=8)
                P('#FFB060', rough=0.3, emit=0.9).box(mast + V((0, 0, 1.4)), (0.18, 0.18, 0.24))
                ctx.light(tuple(mast + V((0, 0, 1.6))), 6.0, (12.0, 7.0, 3.0))
        else:
            # the bank: cane and clover in small fields, date palms, a mud wall on the lane side
            P('#3A4A26', rough=0.95).box((cx, cy, 0.3), (w - 0.4, d - 0.4, 0.6))
            for k in range(int(w * d / 1.2)):
                px, py = rnd.uniform(x0 + 0.4, x1 - 0.4), rnd.uniform(y0 + 0.4, y1 - 0.4)
                hh = rnd.uniform(1.0, 2.2) if not low else rnd.uniform(0.5, 1.0)
                P(rnd.choice(['#4A6A2E', '#5A7A34', '#3E5A28']), flat=False).capsule(V((px, py, 0.5)), V((px, py, 0.5 + hh)), 0.05, 0.02, seg=4)
            for k in range(1 if low else rnd.randint(2, 3)):
                palm(P, rnd.uniform(x0 + 0.8, x1 - 0.8), rnd.uniform(y0 + 0.8, y1 - 0.8), rnd.uniform(4.5, 7.0) if not low else 3.4, rnd)
            for s in sides:
                if s in ('N', 'S'):
                    y = y1 - 0.15 if s == 'N' else y0 + 0.15
                    P('#6A5238').box((cx, y, 0.45), (w, 0.3, 0.9))
                else:
                    x = x1 - 0.15 if s == 'E' else x0 + 0.15
                    P('#6A5238').box((x, cy, 0.45), (0.3, d, 0.9))
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal':
            for (x, y) in rnd.sample(junction_corners(lanes, 0.5), 1):
                # a clay water jar on a wooden stand, and a hurricane lamp hung beside it
                P('#8A5A3A', flat=False).sphere((x, y, 0.75), (0.32, 0.32, 0.42), seg=10)
                P('#4A3A2A').box((x, y, 0.25), (0.6, 0.6, 0.5))
                P('#FFB060', rough=0.3, emit=0.9).box((x + 0.45, y, 1.3), (0.16, 0.16, 0.22))
                ctx.light((x + 0.45, y, 1.5), 6.0, (12.0, 7.5, 3.2))
                ctx.solid(x, y, 0.35, 0.35)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        for k in range(6):   # a stone landing stair down to the water
            P('#8A7A62').box((0, -7.9 + k * 0.35, 0.05 + k * 0.08), (Nile.LANE - 0.8, 0.35, 0.16))
        for sx in (-1, 1):
            post_lamp(P, ctx, sx * (Nile.LANE / 2 - 0.4), -5.2, h=3.4, color='#FFB060', light=(13.0, 8.0, 3.5))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # a sluice on the canal: a basin of black water to the north, the gate's two stone piers and its iron wheel
        P('#1E4C5A', rough=0.05, metal=0.4, emit=0.1).box((0, 4.4, 0.03), (10.0, 3.2, 0.02))
        for k in range(20):
            P('#B8E0EC', rough=0.2, emit=0.3).box((rnd.uniform(-4.5, 4.5), rnd.uniform(3.2, 5.6), 0.043), (rnd.uniform(0.4, 1.0), 0.03, 0.005))
        ctx.solid(0, 4.4, 5.0, 1.6)
        for sx in (-1, 1):
            P('#8A7A62').box((sx * 1.6, 6.2, 1.6), (1.0, 1.4, 3.2))
            ctx.solid(sx * 1.6, 6.2, 0.5, 0.7)
        P('#3A3430', metal=0.7).box((0, 6.2, 2.4), (2.4, 0.3, 1.6))
        P('#3A3430', metal=0.7, flat=False).sweep([V((0.9 * math.cos(a), 5.9, 3.6 + 0.9 * math.sin(a))) for a in [TAU * k / 16 for k in range(16)]],
                                                   0.06, seg=5, closed=True)
        for x in (-4.2, 4.2):
            post_lamp(P, ctx, x, 2.2, h=3.0, color='#9FE0F0', light=(4.0, 10.0, 14.0))
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # a saqiya: the ox-driven waterwheel, its pots in a ring, the gearing under a palm-trunk frame (in the court's south
        # half: the way in is from the north)
        c = V((0, -2.6, 0))
        P('#1E4C5A', rough=0.05, metal=0.4, emit=0.1).box((0, -4.6, 0.03), (4.4, 2.0, 0.02))
        rim = [c + V((2.0 * math.cos(a), -1.9, 2.2 + 2.0 * math.sin(a))) for a in [TAU * k / 20 for k in range(20)]]
        P('#5A4430', flat=False).sweep(rim, 0.08, seg=6, closed=True)
        for k in range(12):
            a = TAU * k / 12
            p = c + V((2.0 * math.cos(a), -1.9, 2.2 + 2.0 * math.sin(a)))
            P('#5A4430', flat=False).capsule(c + V((0, -1.9, 2.2)), p, 0.05, seg=5)
            P('#9A5A34', flat=False).sphere(p + V((0, -0.2, 0)), (0.18, 0.18, 0.24), seg=8)
        for sx in (-1, 1):
            P('#6A5238', flat=False).capsule(V((sx * 2.4, -4.5, 0)), V((sx * 2.4, -4.5, 4.6)), 0.14, seg=6)
        P('#6A5238', flat=False).capsule(V((-2.4, -4.5, 4.4)), V((2.4, -4.5, 4.4)), 0.12, seg=6)
        ctx.solid(0, -4.5, 2.6, 1.2)
        post_lamp(P, ctx, -3.4, -1.0, h=3.2)
        ctx.points['chest'] = [2.8, 0.4]
        P.flush()


# ================================================================ a village of Upper Egypt
class Village:
    NAME, LANE = 'village', 5.0
    MUD = ['#A8865C', '#9A7A52', '#B09066', '#8E7050']

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#6E5A40').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#B09A76', rough=0.98).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            for k in range(int((x1 - x0) * (y1 - y0) / 6)):
                px, py = rnd.uniform(x0 + 0.3, x1 - 0.3), rnd.uniform(y0 + 0.3, y1 - 0.3)
                P(rnd.choice(['#A48E6A', '#BCA682', '#9C8662'])).box((px, py, 0.025), (rnd.uniform(0.3, 0.8), rnd.uniform(0.2, 0.5), 0.02),
                                                                     rotz(rnd.uniform(0, 3)))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        h = rnd.uniform(2.6, 3.2) if low else rnd.uniform(3.6, 5.6)
        white = rnd.random() < 0.35
        P('#D8D0BC' if white else rnd.choice(Village.MUD)).box((cx, cy, h / 2), (w, d, h))
        P('#8E7050').box((cx, cy, h + 0.12), (w + 0.1, d + 0.1, 0.24))    # the parapet
        for k in range(rnd.randint(1, 3)):   # roof clutter: palm fronds and firewood, a clay oven
            P(rnd.choice(['#6A5A36', '#5A4A2E']), flat=False).capsule(V((cx + rnd.uniform(-w / 3, w / 3), cy + rnd.uniform(-d / 3, d / 3), h + 0.3)),
                                                                     V((cx + rnd.uniform(-w / 3, w / 3), cy + rnd.uniform(-d / 3, d / 3), h + 0.35)), 0.12, seg=5)
        if not low and rnd.random() < 0.4 and w > 3 and d > 3:
            # a pigeon tower: a tall whitewashed cone studded with clay pots
            tx, ty = cx + rnd.uniform(-w / 5, w / 5), cy + rnd.uniform(-d / 5, d / 5)
            P('#E4DCC8', flat=False).sloft([(V((tx, ty, h + z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((0, 1.2), (2.6, 0.9), (3.8, 0.45), (4.3, 0.05))], seg=12)
            for k in range(22):
                a = TAU * k / 11 + (k // 11) * 0.3
                z = 1.0 + (k // 11) * 1.2
                r = 1.2 - z * 0.12
                P('#8A5A3A', flat=False).sphere((tx + r * math.cos(a), ty + r * math.sin(a), h + z), 0.08, seg=6)
        for s in sides:   # blue doors and small high windows, a lamp now and then
            pts, n = face_points(x0, y0, x1, y1, s)
            horiz = s in ('N', 'S')
            for i, (px, py) in enumerate(pts):
                if i % 2 == 0:
                    P(rnd.choice(['#2A5A9A', '#2E6A8A', '#3A4A8A'])).box((px + n[0] * 0.04, py + n[1] * 0.04, 1.0),
                                                                          (1.0 if horiz else 0.08, 0.08 if horiz else 1.0, 2.0))
                else:
                    lit = rnd.random() < 0.4
                    P('#FFB060' if lit else '#1A1410', rough=0.5, emit=0.5 if lit else 0.0).box(
                        (px + n[0] * 0.04, py + n[1] * 0.04, min(h - 0.6, 2.4)), (0.5 if horiz else 0.08, 0.08 if horiz else 0.5, 0.5))
                    if lit:
                        ctx.light((px + n[0] * 1.0, py + n[1] * 1.0, 2.0), 4.5, (9.0, 6.0, 2.6))
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal':
            for (x, y) in rnd.sample(junction_corners(lanes, 0.5), 2):
                if rnd.random() < 0.5:   # a mastaba bench of mud brick
                    P('#9A7A52').box((x, y, 0.25), (0.9, 0.5, 0.5))
                    ctx.solid(x, y, 0.45, 0.25)
                else:   # a stack of water jars
                    for k in range(3):
                        P('#8A5A3A', flat=False).sphere((x + (k - 1) * 0.3, y, 0.3), (0.16, 0.16, 0.28), seg=8)
                    ctx.solid(x, y, 0.45, 0.2)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        for sx in (-1, 1):   # the village gate: two whitewashed posts, a palm-trunk beam, a lamp
            P('#D8D0BC').box((sx * (Village.LANE / 2 + 0.4), -7.0, 1.6), (0.8, 0.8, 3.2))
            ctx.solid(sx * (Village.LANE / 2 + 0.4), -7.0, 0.4, 0.4)
        P('#6A5238', flat=False).capsule(V((-Village.LANE / 2 - 0.6, -7.0, 3.3)), V((Village.LANE / 2 + 0.6, -7.0, 3.3)), 0.16, seg=6)
        P('#FFB060', rough=0.3, emit=0.9).box((0, -6.9, 2.8), (0.24, 0.24, 0.3))
        ctx.light((0, -6.4, 2.6), 7.0, (13.0, 8.0, 3.4))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # the village square round a great sycamore fig, a bench round its trunk, lamps strung in its branches
        P('#5A4430', flat=False).capsule(V((0, 3.0, 0)), V((0.2, 3.0, 3.2)), 0.55, 0.4, seg=10)
        for k in range(6):
            a = TAU * k / 6
            P('#5A4430', flat=False).capsule(V((0.2, 3.0, 3.0)), V((2.4 * math.cos(a), 3.0 + 2.0 * math.sin(a), 4.2)), 0.18, 0.08, seg=6)
            P(rnd.choice(['#2E4A22', '#3A5626']), flat=False).sphere((2.4 * math.cos(a), 3.0 + 2.0 * math.sin(a), 4.6), (1.4, 1.4, 0.9), seg=8)
            P('#FFC070', rough=0.3, emit=0.9).box((1.6 * math.cos(a), 3.0 + 1.4 * math.sin(a), 3.7), (0.14, 0.14, 0.18))
        ctx.light((0, 3.0, 3.4), 11.0, (18.0, 10.0, 4.0))
        P('#9A7A52').box((0, 3.0, 0.25), (2.4, 2.4, 0.5))
        ctx.solid(0, 3.0, 1.2, 1.2)
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # the headman's guest house (a mandara): a domed whitewashed room with a carved wooden screen, lamps at the door
        P('#E4DCC8').box((0, -3.6, 1.8), (5.0, 3.6, 3.6))
        P('#E4DCC8', flat=False).sphere((0, -3.6, 3.6), (1.8, 1.6, 1.3), seg=14)
        P('#5A3A22').box((0, -1.78, 1.2), (1.4, 0.06, 2.4))
        for sx in (-1, 1):
            P('#FFB060', rough=0.3, emit=0.9).box((sx * 1.1, -1.7, 2.3), (0.2, 0.2, 0.28))
        ctx.light((0, -1.0, 2.4), 8.0, (14.0, 8.5, 3.6))
        ctx.solid(0, -3.6, 2.5, 1.8)
        ctx.points['chest'] = [-2.6, 0.2]
        P.flush()


# ================================================================ Karnak: the hypostyle hall
class Karnak:
    NAME, LANE = 'karnak', 6.0
    STONE = ['#C8A878', '#BC9C6C', '#D2B484', '#B89868']

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#5E5040').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#9C8664').box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            for x in frange(x0 + 0.75, x1 - 0.75, 1.5):
                for y in frange(y0 + 1.0, y1 - 1.0, 2.0):
                    if rnd.random() < 0.8:
                        P(rnd.choice(['#B09A76', '#A89270', '#B8A27E'])).box((x, y, 0.03), (1.44, 1.94, 0.03))
        P.flush()

    @staticmethod
    def column(P, x, y, h, r, rnd, band=True):
        """A papyrus column: a drum shaft with painted bands, an open papyrus capital and an abacus block."""
        P(rnd.choice(Karnak.STONE), flat=False).sloft([(V((x, y, z)), V((1, 0, 0)), V((0, 1, 0)), rr, rr) for z, rr in ((0, r * 1.08), (0.3, r),
                                                                                                                   (h * 0.85, r * 0.92))], seg=14)
        if band:
            for z in (h * 0.3, h * 0.55):
                P('#2E5A8A' if z < h * 0.4 else '#8A3A2A', rough=0.8, flat=False).sloft(
                    [(V((x, y, zz)), V((1, 0, 0)), V((0, 1, 0)), r * 0.935, r * 0.935) for zz in (z, z + 0.25)], seg=14)
        P(rnd.choice(Karnak.STONE), flat=False).sloft([(V((x, y, h * 0.85 + z)), V((1, 0, 0)), V((0, 1, 0)), rr, rr)
                                                       for z, rr in ((0, r * 0.92), (h * 0.1, r * 1.35), (h * 0.15, r * 1.5))], seg=14)
        P('#B09470').box((x, y, h + 0.25), (r * 2.2, r * 2.2, 0.5))

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        if low:
            # a low screen wall, carved in bands, and fallen column drums before it
            h = rnd.uniform(1.6, 2.2)
            P(rnd.choice(Karnak.STONE)).box((cx, cy, h / 2), (w, d, h))
            for s in sides:
                pts, n = face_points(x0, y0, x1, y1, s)
                horiz = s in ('N', 'S')
                for (px, py) in pts:
                    for k in range(3):
                        P('#8C7250').box((px + n[0] * 0.03, py + n[1] * 0.03, 0.5 + k * 0.45), (1.6 if horiz else 0.05, 0.05 if horiz else 1.6, 0.08))
                    P('#A08462').box((px + n[0] * 0.03 + (0.3 if horiz else 0), py + n[1] * 0.03 + (0 if horiz else 0.3), 0.95),
                                     (0.3 if horiz else 0.05, 0.05 if horiz else 0.3, 0.5))
            if rnd.random() < 0.6:
                a = rnd.uniform(0, 3)
                P(rnd.choice(Karnak.STONE), flat=False).capsule(V((cx - math.cos(a) * 0.6, cy - math.sin(a) * 0.6, h + 0.7)),
                                                                V((cx + math.cos(a) * 0.6, cy + math.sin(a) * 0.6, h + 0.7)), 0.7, seg=12)
        else:
            # the hall: papyrus columns on a grid, roofed here and there with the old stone beams
            h = rnd.uniform(9.0, 11.5)
            P('#6A5A46').box((cx, cy, 0.15), (w, d, 0.3))
            nx, ny = max(1, int(w / 3.2)), max(1, int(d / 3.2))
            pts = []
            for i in range(nx):
                for j in range(ny):
                    x = x0 + w * (i + 0.5) / nx
                    y = y0 + d * (j + 0.5) / ny
                    Karnak.column(P, x, y, h, 1.0 if min(w, d) > 3.6 else 0.8, rnd)
                    pts.append((x, y))
            if rnd.random() < 0.6 and len(pts) > 1:
                (ax, ay), (bx, by) = pts[0], pts[-1]
                P('#A88C68').box(((ax + bx) / 2, (ay + by) / 2, h + 0.7), (abs(bx - ax) + 2.2, abs(by - ay) + 2.2, 0.6))
        for s in sides:
            if not low and rnd.random() < 0.5:
                pts, n = face_points(x0, y0, x1, y1, s, inset=0.3)
                if pts:
                    px, py = pts[0]
                    P('#3A3430', metal=0.5).box((px, py, 1.3), (0.12, 0.12, 2.6))
                    P('#FF9A40', rough=0.4, emit=1.0, flat=False).sphere((px, py, 2.75), (0.16, 0.16, 0.22), seg=6)
                    ctx.light((px + n[0] * 0.6, py + n[1] * 0.6, 2.6), 6.5, (15.0, 7.5, 2.5))
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal' and rnd.random() < 0.6:
            (x, y) = rnd.choice(junction_corners(lanes, 0.8))
            P('#B8A07C').box((x, y, 0.35), (1.0, 1.0, 0.7))   # a statue's empty base
            ctx.solid(x, y, 0.5, 0.5)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        for sx in (-1, 1):   # a pylon's two sloping towers either side of the way in
            x = sx * (Karnak.LANE / 2 + 1.4)
            P('#C8A878', flat=False).sloft([(V((x, -6.8, z)), V((1, 0, 0)), V((0, 1, 0)), rx, 1.0) for z, rx in ((0, 1.4), (4.4, 1.0))], seg=16, p=12.0)
            ctx.solid(x, -6.8, 1.4, 1.0)
        for sx in (-1, 1):
            post_lamp(P, ctx, sx * (Karnak.LANE / 2 - 0.3), -5.0, h=2.6, color='#FF9A40', light=(15.0, 7.5, 2.5))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # the avenue of rams: two rows of recumbent ram-headed sphinxes on plinths, facing the way
        for sx in (-1, 1):
            for k in range(3):
                x, y = sx * 5.4, -2.6 + k * 3.2
                P('#B8A07C').box((x, y, 0.4), (1.2, 2.4, 0.8))
                P('#C8A878', flat=False).sphere((x, y + 0.1, 1.2), (0.5, 1.0, 0.45), seg=10)
                P('#C8A878', flat=False).sphere((x - sx * 0.1, y - 0.95, 1.6), (0.34, 0.4, 0.36), seg=10)
                for s2 in (-1, 1):
                    P('#A88C68', flat=False).sweep([V((x - sx * 0.1 + s2 * 0.28, y - 0.9, 1.75)), V((x + s2 * 0.5, y - 0.75, 1.55)),
                                                    V((x + s2 * 0.4, y - 1.05, 1.35))], 0.07, seg=5)
                ctx.solid(sx * 5.95, y, 0.55, 1.2)   # to the court's wall: no slot behind them to be caught in
        for x in (-2.8, 2.8):
            P('#3A3430', metal=0.5).box((x, 5.6, 0.8), (0.3, 0.3, 1.6))
            P('#FF9A40', rough=0.4, emit=1.0, flat=False).sphere((x, 5.6, 1.8), (0.3, 0.3, 0.26), seg=8)
            ctx.light((x, 5.6, 2.4), 9.0, (20.0, 9.0, 2.6))
            ctx.solid(x, 5.6, 0.2, 0.2)
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # an obelisk: granite, its pyramidion capped in electrum, catching what light there is
        P('#8A5A50', flat=False).sloft([(V((0, 3.2, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((0, 0.9), (13.0, 0.6))], seg=16, p=12.0)
        P('#E8D090', rough=0.25, metal=1.0, emit=0.2, flat=False).sloft([(V((0, 3.2, z)), V((1, 0, 0)), V((0, 1, 0)), r, r)
                                                                          for z, r in ((13.0, 0.6), (14.2, 0.02))], seg=16, p=12.0)
        P('#B8A07C').box((0, 3.2, 0.3), (2.6, 2.6, 0.6))
        ctx.solid(0, 3.2, 1.3, 1.3)
        ctx.light((0, 1.6, 3.0), 9.0, (10.0, 9.0, 8.0))
        ctx.points['chest'] = [2.8, 1.0]
        P.flush()


# ================================================================ the Valley of the Kings
class Valley:
    NAME, LANE = 'valley', 6.0
    STRATA = ['#D8C090', '#CBB280', '#E0CA9C', '#C4A874']

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#8A7656').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#C0A882', rough=0.98).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            for k in range(int((x1 - x0) * (y1 - y0) / 3)):
                px, py = rnd.uniform(x0, x1), rnd.uniform(y0, y1)
                s = rnd.uniform(0.1, 0.35)
                P(rnd.choice(Valley.STRATA)).box((px, py, s * 0.25), (s, s * 0.8, s * 0.5), rotz(rnd.uniform(0, 3)))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        # cliffs in strata, each course set back a little; tall ones get a tomb door on the lane
        n = 2 if low else rnd.randint(4, 6)
        z = 0.0
        for k in range(n):
            hh = rnd.uniform(0.8, 1.3)
            inset = k * 0.12
            P(Valley.STRATA[k % 4]).box((cx, cy, z + hh / 2), (w - inset, d - inset, hh))
            z += hh
        for s in sides:
            if low or rnd.random() < 0.4:
                continue
            pts, n_ = face_points(x0, y0, x1, y1, s)
            if not pts:
                continue
            px, py = pts[len(pts) // 2]
            horiz = s in ('N', 'S')
            P('#1A1410').box((px + n_[0] * 0.03, py + n_[1] * 0.03, 1.3), (1.6 if horiz else 0.08, 0.08 if horiz else 1.6, 2.6))
            P('#E8D6A8').box((px + n_[0] * 0.1, py + n_[1] * 0.1, 2.75), (2.2 if horiz else 0.2, 0.2 if horiz else 2.2, 0.3))
            if rnd.random() < 0.5:   # a bare bulb on a cable, from the diggers
                P('#FFE0A0', rough=0.3, emit=0.9).sphere((px + n_[0] * 0.5, py + n_[1] * 0.5, 2.4), 0.1, seg=6)
                ctx.light((px + n_[0] * 1.0, py + n_[1] * 1.0, 2.2), 6.0, (14.0, 11.0, 6.0))
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal':
            for (x, y) in rnd.sample(junction_corners(lanes, 0.5), 1):
                # the diggers' rubber baskets, stacked, and a wooden ladder laid down
                for k in range(3):
                    P('#2A2624', rough=0.7, flat=False).sloft([(V((x + k * 0.1, y, 0.12 + k * 0.1 + z)), V((1, 0, 0)), V((0, 1, 0)), r, r)
                                                               for z, r in ((0, 0.24), (0.22, 0.3))], seg=10)
                P('#7A5A36').box((x + 0.7, y + 0.4, 0.05), (0.4, 2.0, 0.08))
                ctx.solid(x, y, 0.35, 0.35)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        # the ticket kiosk the guards left, and the rope line to the tombs
        P('#D8D0BC').box((-(Valley.LANE / 2 + 1.0), -6.6, 1.2), (1.8, 1.8, 2.4))
        P('#FFD890', rough=0.3, emit=0.6).box((-(Valley.LANE / 2 + 0.08), -6.6, 1.5), (0.05, 0.9, 0.6))
        ctx.solid(-(Valley.LANE / 2 + 1.0), -6.6, 0.9, 0.9)
        ctx.light((-(Valley.LANE / 2 - 0.6), -6.6, 1.8), 6.0, (12.0, 10.0, 5.0))
        for k in range(5):
            x = Valley.LANE / 2 - 0.3
            P('#8A8A90', metal=0.8).box((x, -7.6 + k * 1.2, 0.5), (0.06, 0.06, 1.0))
        P('#8A2A22').box((Valley.LANE / 2 - 0.3, -5.2, 0.9), (0.04, 4.8, 0.05))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # a tomb's forecourt: the cut face to the north with its great door, fallen blocks, two work lamps
        P(Valley.STRATA[0]).box((0, 6.6, 3.0), (12.0, 1.8, 6.0))
        P('#120E0A').box((0, 5.68, 1.6), (2.4, 0.06, 3.2))
        P('#E8D6A8').box((0, 5.6, 3.4), (3.2, 0.3, 0.4))
        ctx.solid(0, 6.6, 6.0, 0.9)
        for x in (-4.4, 4.4):
            P('#3A3A3C', metal=0.7).box((x, 3.6, 1.1), (0.08, 0.08, 2.2))
            P('#FFF0C0', rough=0.3, emit=1.0).box((x, 3.5, 2.3), (0.4, 0.2, 0.3))
            ctx.light((x, 3.0, 2.2), 10.0, (18.0, 15.0, 9.0))
        for k in range(5):
            s = rnd.uniform(0.7, 1.1)
            x, y = rnd.choice((-1, 1)) * rnd.uniform(3.8, 5.6), rnd.uniform(-3.5, 2.0)
            P(rnd.choice(Valley.STRATA)).box((x, y, s / 2), (s, s * 1.2, s), rotz(rnd.uniform(0, 3)))
            ctx.solid(x, y, s * 0.55, s * 0.6)
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # a tomb stair going down under a lintel, with a guard's chair and a hurricane lamp (south: the way in is north)
        P(Valley.STRATA[1]).box((0, -4.8, 2.0), (6.0, 3.0, 4.0))
        for k in range(6):
            P('#B09874').box((0, -3.1 - k * 0.3, 0.1 - k * 0.001), (1.8, 0.3, 0.02 + 0.001 * k))
        P('#0E0A08').box((0, -3.32, 1.2), (1.8, 0.05, 2.2))
        P('#E8D6A8').box((0, -3.25, 2.5), (2.6, 0.3, 0.3))
        ctx.solid(0, -4.8, 3.0, 1.5)
        P('#5A3A22').box((-2.2, -1.6, 0.45), (0.6, 0.6, 0.9))
        P('#FFB060', rough=0.3, emit=0.9).box((-2.6, -1.6, 0.4), (0.18, 0.18, 0.26))
        ctx.light((-2.6, -1.2, 1.0), 6.0, (13.0, 8.0, 3.6))
        ctx.points['chest'] = [2.6, 1.2]
        P.flush()


# ================================================================ a king's tomb, below
class Tomb:
    NAME, LANE = 'tomb', 4.8
    PLASTER = ['#D8C49A', '#CFB88C', '#E0CCA2']

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#1E1812').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#8A7658').box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            # the modern boardwalk laid over the old floor
            if (x1 - x0) > (y1 - y0):
                for x in frange(x0 + 0.2, x1 - 0.2, 0.3):
                    P('#6A4E32').box((x, (y0 + y1) / 2, 0.05), (0.26, min(2.0, y1 - y0 - 0.6), 0.04))
            else:
                for y in frange(y0 + 0.2, y1 - 0.2, 0.3):
                    P('#6A4E32').box(((x0 + x1) / 2, y, 0.05), (min(2.0, x1 - x0 - 0.6), 0.26, 0.04))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        h = rnd.uniform(1.8, 2.2) if low else rnd.uniform(3.2, 3.8)
        P('#3A3026').box((cx, cy, h / 2), (w, d, h))
        # the ceiling's edge: blue with yellow stars, where the rock meets the painted walls
        P('#1E2E5A', rough=0.8).box((cx, cy, h + 0.03), (w, d, 0.06))
        for k in range(int(w * d / 1.5)):
            P('#E8C860', rough=0.5, emit=0.3).box((rnd.uniform(x0 + 0.2, x1 - 0.2), rnd.uniform(y0 + 0.2, y1 - 0.2), h + 0.065), (0.1, 0.1, 0.01),
                                                  rotz(0.785))
        for s in sides:   # the walls: painted plaster in registers of red, blue and ochre, figures in procession
            pts, n = face_points(x0, y0, x1, y1, s)
            horiz = s in ('N', 'S')
            if horiz:
                y = y1 if s == 'N' else y0
                P(rnd.choice(Tomb.PLASTER)).box((cx, y + n[1] * 0.02, h / 2), (w, 0.04, h))
                for z, c in ((0.3, '#8A3A2A'), (h - 0.35, '#2E4A8A'), (h * 0.55, '#B8862E')):
                    P(c, rough=0.8).box((cx, y + n[1] * 0.05, z), (w, 0.03, 0.12))
            else:
                x = x1 if s == 'E' else x0
                P(rnd.choice(Tomb.PLASTER)).box((x + n[0] * 0.02, cy, h / 2), (0.04, d, h))
                for z, c in ((0.3, '#8A3A2A'), (h - 0.35, '#2E4A8A'), (h * 0.55, '#B8862E')):
                    P(c, rough=0.8).box((x + n[0] * 0.05, cy, z), (0.03, d, 0.12))
            for i, (px, py) in enumerate(pts):   # the figures: a head, a body, a staff; abstract, in profile
                c = rnd.choice(['#6A3A22', '#2A4A7A', '#1A1410'])
                P(c, rough=0.8).box((px + n[0] * 0.06, py + n[1] * 0.06, 1.1), (0.3 if horiz else 0.02, 0.02 if horiz else 0.3, 0.9))
                P('#8A5A3A', rough=0.8).box((px + n[0] * 0.06, py + n[1] * 0.06, 1.72), (0.2 if horiz else 0.02, 0.02 if horiz else 0.2, 0.24))
                if i % 2 == 0:
                    P('#FFB060', rough=0.3, emit=0.8).box((px + n[0] * 0.2 + (0.9 if horiz else 0), py + n[1] * 0.2 + (0 if horiz else 0.9), 2.0),
                                                          (0.12, 0.12, 0.16))
                    ctx.light((px + n[0] * 0.8, py + n[1] * 0.8, 1.9), 4.5, (10.0, 6.5, 2.8))
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        pass

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        for k in range(6):   # the stair down from the valley
            P('#B09874').box((0, -7.9 + k * 0.35, 0.3 - k * 0.05), (Tomb.LANE - 0.6, 0.35, 0.1))
        ctx.light((0, -6.0, 2.4), 7.0, (12.0, 10.0, 7.0))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # the burial hall: square pillars, a granite sarcophagus, and a pit to the north where something vast moves
        for (x, y) in ((-3.6, -1.6), (3.6, -1.6), (-3.6, 2.4), (3.6, 2.4)):
            P('#D8C49A').box((x, y, 1.8), (1.0, 1.0, 3.6))
            P('#2E4A8A', rough=0.8).box((x, y, 3.3), (1.04, 1.04, 0.3))
            ctx.solid(x, y, 0.5, 0.5)
        P('#3A3438', rough=0.4).box((0, 0.4, 0.6), (1.4, 2.8, 1.2))
        P('#4A4448', rough=0.4).box((0, 0.4, 1.3), (1.6, 3.0, 0.2))
        ctx.solid(0, 0.4, 0.8, 1.5)
        P('#050404').box((0, 6.2, 0.005), (9.0, 2.6, 0.01))   # the pit: black
        ctx.solid(0, 6.2, 4.5, 1.3)
        ctx.points['coils'] = [0.0, 6.4]
        for x in (-5.4, 5.4):
            P('#FFB060', rough=0.3, emit=0.9).box((x, 4.4, 2.0), (0.2, 0.2, 0.3))
            ctx.light((x, 4.0, 2.0), 7.0, (13.0, 8.0, 3.4))
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # a side chamber of grave goods: gilded chests, jars, a boat model on its stand (south: the way in is north)
        for k, (x, y) in enumerate(((-2.4, -3.6), (-0.8, -4.2), (1.2, -3.8))):
            P('#C8A040', rough=0.3, metal=1.0).box((x, y, 0.5), (1.1, 0.8, 1.0))
            ctx.solid(x, y, 0.55, 0.4)
        for k in range(5):
            P('#D8D0C0', rough=0.6, flat=False).sphere((2.8 + (k % 2) * 0.4, -2.6 - k * 0.4, 0.4), (0.18, 0.18, 0.36), seg=8)
        P('#6A4A2A').box((2.4, -5.0, 0.5), (2.4, 0.5, 1.0))
        ctx.solid(2.4, -5.0, 1.2, 0.25)
        ctx.light((0, -2.2, 2.2), 8.0, (14.0, 11.0, 5.0))
        ctx.points['chest'] = [-2.6, 0.6]
        P.flush()


REGIONS = [Nile, Village, Karnak, Valley, Tomb]
