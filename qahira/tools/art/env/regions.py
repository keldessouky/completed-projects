"""Act I's regions for the cell kit (env/kit.py): Downtown (Wust el-Balad), the Metro under Tahrir, Khan el-Khalili,
al-Muizz Street, the Mokattam cliffs, and Bab Zuweila (the first trial). Each region supplies its ground, lanes,
blocks, dressing and set pieces; the kit joins them into cells.
"""
import math
from mathutils import Vector as V, Matrix

from qart.geom import Part, TAU
from env.necro import dome


# The shader multiplies emission by 18 into the bloom: at 1.0 a lamp is a white blot, and these streets are full of
# lamps, tubes and neon. Every region's glow goes through this.
EMIT = 0.3


class Paint:
    """Parts batched by material: one model item per colour and finish, however many boxes share it."""

    def __init__(self, m):
        self.m, self.parts = m, {}

    def __call__(self, color, rough=0.9, metal=0.0, emit=0.0, flat=True):
        key = (color, rough, metal, emit, flat)
        if key not in self.parts:
            self.parts[key] = Part()
        return self.parts[key]

    def flush(self):
        for (color, rough, metal, emit, flat), p in self.parts.items():
            self.m.add(p, color, rough=rough, metal=metal, emit=emit * EMIT, flat=flat)
        self.parts = {}


def post_lamp(P, ctx, x, y, h=4.2, color='#FFB04A', light=(15.0, 8.5, 3.4), r=8.0, arm=0.0):
    P('#26221F', rough=0.6, metal=0.5).box((x, y, h / 2), (0.12, 0.12, h))
    P(color, rough=0.3, emit=0.9).box((x + arm, y, h + 0.1), (0.34, 0.34, 0.24))
    ctx.light((x + arm, y, h - 0.2), r, light)
    ctx.solid(x, y, 0.14, 0.14)


def windows(P, x0, y0, x1, y1, z0, z1, side, rnd, lit=0.35, lit_col='#FFB870', dark='#1A1614', step=1.8, floor=3.0, depth=0.08):
    """Rows of windows on one face of a block."""
    z = z0 + floor * 0.45
    while z + 0.8 < z1:
        if side in ('N', 'S'):
            y = y1 if side == 'N' else y0
            x = x0 + 0.9
            while x + 0.5 < x1:
                on = rnd.random() < lit
                P(lit_col if on else dark, rough=0.5, emit=0.35 if on else 0.0).box((x, y + (depth if side == 'N' else -depth), z), (0.8, 0.1, 1.1))
                x += step
        else:
            x = x1 if side == 'E' else x0
            y = y0 + 0.9
            while y + 0.5 < y1:
                on = rnd.random() < lit
                P(lit_col if on else dark, rough=0.5, emit=0.35 if on else 0.0).box((x + (depth if side == 'E' else -depth), y, z), (0.1, 0.8, 1.1))
                y += step
        z += floor


def face_points(x0, y0, x1, y1, side, inset=0.0):
    """Evenly spaced points along a block's lane-facing side, and the outward normal."""
    if side == 'N': return [(x, y1 + inset) for x in frange(x0 + 1.2, x1 - 1.2, 2.6)], (0, 1)
    if side == 'S': return [(x, y0 - inset) for x in frange(x0 + 1.2, x1 - 1.2, 2.6)], (0, -1)
    if side == 'E': return [(x1 + inset, y) for y in frange(y0 + 1.2, y1 - 1.2, 2.6)], (1, 0)
    return [(x0 - inset, y) for y in frange(y0 + 1.2, y1 - 1.2, 2.6)], (-1, 0)


def frange(a, b, step):
    out = []
    x = a
    while x <= b + 1e-6:
        out.append(x)
        x += step
    if not out and b >= a - 1:
        out.append((a + b) / 2)
    return out


def vertical(r):
    """Does a lane rectangle run north-south? The crossing counts as both; arms run away from it."""
    x0, y0, x1, y1 = r
    if y0 > -0.01 or y1 < 0.01:
        return True
    if x0 > -0.01 or x1 < 0.01:
        return False
    return (y1 - y0) >= (x1 - x0)


def junction_corners(lanes, inset=0.45):
    x0, y0, x1, y1 = lanes[0]
    return [(x0 + inset, y0 + inset), (x1 - inset, y1 - inset), (x1 - inset, y0 + inset), (x0 + inset, y1 - inset)]


# ================================================================ Downtown: Wust el-Balad
class Downtown:
    NAME, LANE = 'downtown', 6.2
    FACADES = ['#A08A70', '#8E7A64', '#B09478', '#7A6A5C', '#9A8266', '#C0A585']
    NEON = [('#FF2E88', (14.0, 2.5, 7.0)), ('#1FC8C0', (2.5, 11.0, 10.0)), ('#F2A541', (14.0, 8.0, 2.5))]

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#221E1C').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#34302E', rough=0.95).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.005), (x1 - x0, y1 - y0, 0.02))
            # sidewalk slabs along the long edges, dashed lines down the middle
            if vertical((x0, y0, x1, y1)):
                for sx in (x0 + 0.5, x1 - 0.5):
                    P('#6A625A').box((sx, (y0 + y1) / 2, 0.06), (1.0, y1 - y0, 0.12))
                for y in frange(y0 + 0.8, y1 - 0.8, 2.4):
                    P('#9A9070', rough=0.8).box(((x0 + x1) / 2, y, 0.02), (0.14, 1.1, 0.02))
            else:
                for sy in (y0 + 0.5, y1 - 0.5):
                    P('#6A625A').box(((x0 + x1) / 2, sy, 0.06), (x1 - x0, 1.0, 0.12))
                for x in frange(x0 + 0.8, x1 - 0.8, 2.4):
                    P('#9A9070', rough=0.8).box((x, (y0 + y1) / 2, 0.02), (1.1, 0.14, 0.02))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        h = rnd.uniform(3.0, 3.8) if low else rnd.uniform(5.8, 8.5)
        col = rnd.choice(Downtown.FACADES)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        P(col).box((cx, cy, h / 2), (w, d, h))
        P('#5A5048').box((cx, cy, h + 0.12), (w + 0.1, d + 0.1, 0.24))   # a parapet cap
        ctx.solid(cx, cy, w / 2, d / 2)
        for s in sides:
            windows(P, x0, y0, x1, y1, 3.2, h, s, rnd)
            pts, n = face_points(x0, y0, x1, y1, s)
            for (px, py) in pts:
                r = rnd.random()
                if r < 0.07:   # a lit shop: an opening and a neon sign over it (one in five of what it was)
                    col_n, light = rnd.choice(Downtown.NEON)
                    horiz = s in ('N', 'S')
                    P('#FFC880', rough=0.5, emit=0.35).box((px + n[0] * 0.05, py + n[1] * 0.05, 1.2),
                                                          (1.8 if horiz else 0.1, 0.1 if horiz else 1.8, 2.2))
                    P(col_n, rough=0.4, emit=1.0).box((px + n[0] * 0.2, py + n[1] * 0.2, 2.75), (1.6 if horiz else 0.08, 0.08 if horiz else 1.6, 0.34))
                    ctx.light((px + n[0] * 1.2, py + n[1] * 1.2, 2.6), 5.5, light)
                elif r < 0.6:  # a shuttered shop
                    horiz = s in ('N', 'S')
                    P('#5A5A5E', rough=0.6, metal=0.5).box((px + n[0] * 0.05, py + n[1] * 0.05, 1.2), (2.0 if horiz else 0.1, 0.1 if horiz else 2.0, 2.3))
                if rnd.random() < 0.4 and h > 4:  # an air conditioner under a window
                    P('#C8C4BA', rough=0.6, metal=0.3).box((px + n[0] * 0.3, py + n[1] * 0.3, 4.4), (0.7 if s in 'NS' else 0.5, 0.5 if s in 'NS' else 0.7, 0.45))
        # the roof: water tanks and satellite dishes
        for k in range(rnd.randint(1, 3)):
            rx, ry = rnd.uniform(x0 + 0.8, x1 - 0.8), rnd.uniform(y0 + 0.8, y1 - 0.8)
            if rnd.random() < 0.5:
                P('#3A5A6A', rough=0.5).box((rx, ry, h + 0.6), (0.9, 0.9, 1.2))
            else:
                P('#D8D4CC', rough=0.4, metal=0.4, flat=False).sphere((rx, ry, h + 0.5), (0.45, 0.45, 0.18), seg=10)
                P('#3A3430', rough=0.6, metal=0.6).box((rx, ry, h + 0.25), (0.06, 0.06, 0.5))
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal':
            for (x, y) in rnd.sample(junction_corners(lanes), 2):
                post_lamp(P, ctx, x, y, color='#FFA040', light=(16.0, 8.0, 2.6))
            # a parked tuk-tuk or two, pulled in by the crossing end of an arm so the cell edges stay open
            for (x0, y0, x1, y1) in lanes[1:]:
                if rnd.random() < 0.55:
                    along_y = vertical((x0, y0, x1, y1))
                    if along_y:
                        cx, cy = x0 + 1.1, (y0 + 1.5 if y0 > 0 else y1 - 1.5)
                        bw, bl = 1.3, 2.4
                    else:
                        cx, cy = (x0 + 1.5 if x0 > 0 else x1 - 1.5), y0 + 1.1
                        bw, bl = 2.4, 1.3
                    col = rnd.choice(['#2A4A8A', '#8A2A22', '#2A6A4A', '#C8A030'])
                    P(col, rough=0.4, metal=0.4).box((cx, cy, 0.7), (bw, bl, 1.1))
                    P('#1A1A1E', rough=0.5).box((cx, cy, 1.35), (bw * 0.9, bl * 0.9, 0.12))
                    ctx.solid(cx, cy, bw / 2, bl / 2)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        l = Downtown.LANE / 2
        for sx in (-1, 1):
            post_lamp(P, ctx, sx * (l - 0.4), -6.5, h=5.0, color='#FFA040', light=(18.0, 9.0, 3.0))
        P('#2A2624', metal=0.5).box((0, -7.4, 4.6), (Downtown.LANE + 0.6, 0.2, 0.3))
        P('#1FC8C0', rough=0.3, emit=1.0).box((0, -7.4, 4.1), (3.6, 0.12, 0.5))   # the district's neon over the road
        ctx.light((0, -6.8, 4.0), 7.0, (2.5, 11.0, 10.0))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # a square with a plinth at its north end and lamps round the edge
        P('#4A4440').box((0, 0, 0.03), (13, 13, 0.06))
        P('#8A7E6E').box((0, 5.2, 0.6), (3.0, 1.6, 1.2))
        P('#6A6258', metal=0.3).box((0, 5.2, 2.4), (0.8, 0.8, 2.4))
        P('#FFD08A', rough=0.3, emit=0.8).box((0, 5.2, 3.8), (0.5, 0.5, 0.5))
        ctx.solid(0, 5.2, 1.5, 0.8)
        ctx.light((0, 5.2, 3.8), 9.0, (16.0, 10.0, 5.0))
        for (x, y) in ((-5.8, -5.8), (5.8, -5.8), (-5.8, 5.8), (5.8, 5.8)):
            post_lamp(P, ctx, x, y, h=4.6, color='#FF2E88', light=(14.0, 3.0, 8.0))
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # the old cinema: a marquee of bulbs and a great painted poster on the court's south side (it opens to the north)
        P('#6A4A3A').box((0, -6.6, 3.2), (10.0, 1.2, 6.4))
        P('#1A1210').box((0, -6.0, 1.3), (3.0, 0.1, 2.6))
        P('#C83A2A', rough=0.6, emit=0.25).box((0, -5.95, 4.3), (6.0, 0.08, 3.2))   # the poster, glowing in the dark
        P('#F2D060', rough=0.3, emit=0.5).box((0, -5.9, 4.3), (4.0, 0.06, 0.5))
        for x in frange(-4.6, 4.6, 0.46):
            P('#FFE0A0', rough=0.3, emit=1.0).box((x, -5.9, 2.9), (0.14, 0.14, 0.14))
        ctx.light((0, -4.8, 3.2), 10.0, (18.0, 12.0, 6.0))
        ctx.solid(0, -6.6, 5.0, 0.6)
        post_lamp(P, ctx, -4.4, -4.4, color='#FFA040', light=(14.0, 7.0, 2.6))
        ctx.points['chest'] = [3.0, -3.8]
        ctx.points['poster'] = [-3.0, -3.8]
        P.flush()


# ================================================================ the Metro under Tahrir
class Metro:
    NAME, LANE = 'metro', 6.0

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#1C1A1E').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#7E7C78', rough=0.6).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            # tile joints and the yellow tactile strip along one edge
            along_y = vertical((x0, y0, x1, y1))
            for t in frange((x0 if not along_y else y0) + 0.75, (x1 if not along_y else y1) - 0.75, 1.5):
                if along_y: P('#5E5C58').box(((x0 + x1) / 2, t, 0.022), (x1 - x0, 0.04, 0.01))
                else: P('#5E5C58').box((t, (y0 + y1) / 2, 0.022), (0.04, y1 - y0, 0.01))
            if along_y: P('#C8A830', rough=0.7).box((x0 + 0.35, (y0 + y1) / 2, 0.025), (0.3, y1 - y0, 0.02))
            else: P('#C8A830', rough=0.7).box(((x0 + x1) / 2, y0 + 0.35, 0.025), (x1 - x0, 0.3, 0.02))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        ctx.solid(cx, cy, w / 2, d / 2)
        if w > 3.5 and d > 3.5 and rnd.random() < 0.45:
            # a sunken track bed with a stalled carriage in it
            P('#121014').box((cx, cy, 0.3), (w, d, 0.6))
            along_y = d > w
            for k in (-0.5, 0.5):
                if along_y: P('#6A6A70', rough=0.3, metal=0.9).box((cx + k * 1.2, cy, 0.64), (0.08, d, 0.08))
                else: P('#6A6A70', rough=0.3, metal=0.9).box((cx, cy + k * 1.2, 0.64), (w, 0.08, 0.08))
            cw, cl = (2.6, d - 0.6) if along_y else (w - 0.6, 2.6)
            h = 2.2 if low else 3.2
            P('#B8B4A8', rough=0.5, metal=0.4).box((cx, cy, 0.7 + h / 2), (cw, cl, h))
            P('#C0302A', rough=0.5).box((cx, cy, 1.0), (cw + 0.04, cl + 0.04, 0.25))
            for s in sides:
                pts, n = face_points(cx - cw / 2, cy - cl / 2, cx + cw / 2, cy + cl / 2, s)
                for (px, py) in pts:
                    P('#9FE0D0', rough=0.2, emit=0.55).box((px + n[0] * 0.03, py + n[1] * 0.03, 0.7 + h * 0.62),
                                                          (1.1 if s in 'NS' else 0.06, 0.06 if s in 'NS' else 1.1, 0.7))
            ctx.light((cx, cy, h + 1.2), 6.0, (5.0, 10.0, 9.0))
        else:
            h = rnd.uniform(2.4, 3.0) if low else rnd.uniform(3.6, 4.6)
            P('#4A4648').box((cx, cy, h / 2), (w, d, h))
            for s in sides:
                # cream tile cladding, an advert panel and a bench
                pts, n = face_points(x0, y0, x1, y1, s)
                horiz = s in ('N', 'S')
                fx = cx if horiz else (x1 + 0.03 if s == 'E' else x0 - 0.03)
                fy = cy if not horiz else (y1 + 0.03 if s == 'N' else y0 - 0.03)
                P('#D8D2C0', rough=0.4).box((fx, fy, 1.3), (w if horiz else 0.06, 0.06 if horiz else d, 2.4))
                for i, (px, py) in enumerate(pts):
                    if i % 2 == 0:
                        P(rnd.choice(['#F2E8C0', '#C0E8F2', '#F2C0C8']), rough=0.3, emit=0.6).box(
                            (px + n[0] * 0.08, py + n[1] * 0.08, 1.6), (1.4 if horiz else 0.05, 0.05 if horiz else 1.4, 0.9))
                    elif rnd.random() < 0.6:
                        P('#6A6A6E', rough=0.5, metal=0.6).box((px + n[0] * 0.5, py + n[1] * 0.5, 0.45), (1.6 if horiz else 0.5, 0.5 if horiz else 1.6, 0.1))
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        # fluorescent tubes hung over the lanes; now and then a red emergency lamp
        for i, (x0, y0, x1, y1) in enumerate(lanes):
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            along_y = vertical((x0, y0, x1, y1))
            P('#E8FFF0', rough=0.2, emit=1.0).box((cx, cy, 3.4), (0.14 if along_y else min(3.0, x1 - x0 - 1), min(3.0, y1 - y0 - 1) if along_y else 0.14, 0.08))
            red = rnd.random() < 0.2
            ctx.light((cx, cy, 3.0), 7.5, (14.0, 2.0, 2.0) if red else (7.0, 11.0, 10.0))
        # a round red "M" sign at the junction
        x, y = junction_corners(lanes, 0.35)[rnd.randint(0, 3)]
        P('#C8202A', rough=0.4, emit=0.8, flat=False).sphere((x, y, 2.6), (0.34, 0.06, 0.34), seg=12)
        P('#2A2628', rough=0.6, metal=0.5).box((x, y, 1.2), (0.08, 0.08, 2.4))
        ctx.solid(x, y, 0.12, 0.12)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        # the stair down from the street, with rails and a row of turnstiles
        for k in range(6):
            P('#6A6864').box((0, -7.8 + k * 0.3, 0.9 - k * 0.15), (Metro.LANE - 0.4, 0.3, 0.3))
        for sx in (-1, 1):
            P('#8A8A90', rough=0.3, metal=0.9).box((sx * (Metro.LANE / 2 - 0.3), -6.9, 1.0), (0.06, 1.8, 0.06))
        for k in range(-2, 3):
            if k == 0:
                continue
            P('#3A3A40', metal=0.6).box((k * 1.1, -4.8, 0.5), (0.3, 0.9, 1.0))
            ctx.solid(k * 1.1, -4.8, 0.15, 0.45)
        ctx.light((0, -5.5, 2.8), 7.0, (8.0, 12.0, 11.0))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # a station hall: four columns, a long mural on the north wall, cold light
        for (x, y) in ((-4, -2), (4, -2), (-4, 3), (4, 3)):
            P('#8A8680', rough=0.5).box((x, y, 2.0), (0.8, 0.8, 4.0))
            ctx.solid(x, y, 0.4, 0.4)
            ctx.light((x, y - 0.8, 3.2), 7.0, (6.0, 10.0, 9.0))
        colors = ['#2BB5AE', '#F2A541', '#FF2E88', '#D4A84B', '#7A6AD0']
        for k in range(10):
            P(colors[k % 5], rough=0.4, emit=0.3).box((-5.4 + k * 1.2, 6.45, 2.2), (1.1, 0.1, 2.6))
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # a stalled train across the south of the court (the landmark opens to the north), its doors open and its lights still on
        P('#B8B4A8', rough=0.5, metal=0.4).box((0, -4.6, 1.8), (10.6, 2.6, 2.8))
        P('#C0302A', rough=0.5).box((0, -4.6, 0.8), (10.64, 2.64, 0.3))
        for x in (-4, -1.4, 1.4, 4):
            P('#9FE0D0', rough=0.2, emit=0.6).box((x, -3.28, 2.3), (1.2, 0.06, 0.9))
        P('#1A1A1E').box((0, -3.3, 1.4), (1.6, 0.06, 2.0))
        ctx.solid(0, -4.6, 5.3, 1.3)
        ctx.light((0, -2.6, 2.6), 9.0, (6.0, 11.0, 10.0))
        ctx.points['chest'] = [0, -2.1]
        P.flush()


# ================================================================ Khan el-Khalili
def pointed_arch_recess(P, px, py, n, width, height, lit, rnd):
    horiz = n[1] != 0
    P('#FFB866' if lit else '#1E1612', rough=0.6, emit=0.4 if lit else 0.0).box(
        (px + n[0] * 0.04, py + n[1] * 0.04, height * 0.45), (width if horiz else 0.08, 0.08 if horiz else width, height * 0.9))
    # the arch head: stepped voussoirs meeting in a point
    for k in range(4):
        wk = width * (1 - k * 0.24)
        P('#CBB08A').box((px + n[0] * 0.08, py + n[1] * 0.08, height * 0.9 + k * 0.14), (wk if horiz else 0.1, 0.1 if horiz else wk, 0.14))


class Khan:
    NAME, LANE = 'khan', 4.6
    STONE = ['#A89070', '#9A8466', '#B49C7A', '#8E7A60']
    GOODS = ['#C8502A', '#E8A020', '#7A9A3A', '#A0301A', '#D8C060', '#6A3A20']

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#3E342A').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#6E6252').box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            for k in range(int((x1 - x0) * (y1 - y0) / 1.2)):
                px, py = rnd.uniform(x0 + 0.3, x1 - 0.3), rnd.uniform(y0 + 0.3, y1 - 0.3)
                s = rnd.uniform(0.5, 0.9)
                P(rnd.choice(['#8A7C68', '#7E705C', '#968670'])).box((px, py, 0.03), (s, s * rnd.uniform(0.6, 1.0), 0.03),
                                                                   Matrix.Rotation(rnd.uniform(0, 3), 4, 'Z'))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        h = rnd.uniform(2.8, 3.4) if low else rnd.uniform(4.6, 6.2)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        P(rnd.choice(Khan.STONE)).box((cx, cy, h / 2), (w, d, h))
        ctx.solid(cx, cy, w / 2, d / 2)
        for s in sides:
            pts, n = face_points(x0, y0, x1, y1, s)
            horiz = s in ('N', 'S')
            for (px, py) in pts:
                lit = rnd.random() < 0.6
                pointed_arch_recess(P, px, py, n, 1.8, 2.3, lit, rnd)
                if lit:
                    ctx.light((px + n[0] * 1.0, py + n[1] * 1.0, 1.8), 4.5, (12.0, 7.0, 2.8))
                # goods at the shop mouth: sacks of spice or a stack of brass trays
                gx, gy = px + n[0] * 0.55, py + n[1] * 0.55
                if rnd.random() < 0.5:
                    for k in range(3):
                        o = (k - 1) * 0.5
                        P(rnd.choice(Khan.GOODS), rough=0.95, flat=False).sphere((gx + (o if horiz else 0), gy + (0 if horiz else o), 0.3),
                                                                                (0.24, 0.24, 0.3), seg=8)
                else:
                    for k in range(4):
                        P('#C89A45', rough=0.3, metal=1.0, flat=False).sphere((gx, gy, 0.12 + k * 0.1), (0.36, 0.36, 0.03), seg=12)
                if h > 4:   # a mashrabiya bay on the upper floor
                    mx, my = px + n[0] * 0.35, py + n[1] * 0.35
                    P('#4A2E1C', rough=0.8).box((mx, my, 3.7), (1.4 if horiz else 0.6, 0.6 if horiz else 1.4, 1.3))
                    for k in range(5):
                        P('#FFB866', rough=0.5, emit=0.35).box((mx + n[0] * 0.31 + (k - 2) * 0.24 * (1 if horiz else 0),
                                                                my + n[1] * 0.31 + (k - 2) * 0.24 * (0 if horiz else 1), 3.7),
                                                               (0.08 if horiz else 0.04, 0.04 if horiz else 0.08, 1.0))
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        # strings of small lanterns sagging across the lanes
        for (x0, y0, x1, y1) in lanes[1:]:
            along_y = vertical((x0, y0, x1, y1))
            for t in frange((y0 if along_y else x0) + 1.5, (y1 if along_y else x1) - 1.5, 3.0):
                for k in range(7):
                    u = k / 6
                    z = 3.4 - 0.5 * math.sin(math.pi * u)
                    x = x0 + (x1 - x0) * u if along_y else t
                    y = t if along_y else y0 + (y1 - y0) * u
                    P(['#FF8040', '#FFD060', '#40E0C0', '#FF4080'][k % 4], rough=0.3, emit=1.0, flat=False).sphere((x, y, z), 0.09, seg=6)
                cx, cy = ((x0 + x1) / 2, t) if along_y else (t, (y0 + y1) / 2)
                ctx.light((cx, cy, 3.0), 5.0, (12.0, 8.0, 4.0))
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        l = Khan.LANE / 2
        for sx in (-1, 1):
            P('#A89070').box((sx * (l + 0.4), -7.0, 2.4), (0.8, 1.2, 4.8))
            ctx.solid(sx * (l + 0.4), -7.0, 0.4, 0.6)
        for k in range(5):
            P('#B49C7A').box((0, -7.0, 4.4 + k * 0.18), (Khan.LANE + 1.6 - k * 0.5, 1.2, 0.18))
        P('#C89A45', rough=0.3, metal=1.0).box((0, -6.3, 3.4), (0.3, 0.3, 0.5))
        ctx.light((0, -5.8, 3.0), 6.0, (14.0, 8.0, 3.0))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # a court with an octagonal fountain towards the north
        P('#9A8A74', flat=False).sloft([(V((0, 3.4, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((0.0, 1.4), (0.6, 1.4), (0.66, 1.55))], seg=8)
        P('#2A5A60', rough=0.1).box((0, 3.4, 0.55), (2.0, 2.0, 0.04))
        ctx.solid(0, 3.4, 1.3, 1.3)
        for (x, y) in ((-5.6, -5.6), (5.6, -5.6), (-5.6, 5.6), (5.6, 5.6)):
            post_lamp(P, ctx, x, y, h=3.6, color='#FFB04A', light=(14.0, 8.0, 3.0))
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # the coppersmith's workshop: a forge, an anvil, pots and trays hung on the walls, and his bench
        P('#5A3A2A').box((0, -4.6, 1.6), (8.0, 1.6, 3.2))
        P('#FF6020', rough=0.5, emit=1.0).box((-2.4, -3.75, 0.7), (1.2, 0.1, 0.8))
        ctx.light((-2.4, -3.2, 1.2), 7.0, (20.0, 8.0, 2.0))
        P('#3A3A40', rough=0.4, metal=0.9).box((0.5, -2.6, 0.45), (0.9, 0.45, 0.35))
        P('#3A3A40', rough=0.4, metal=0.9).box((0.5, -2.6, 0.2), (0.4, 0.3, 0.4))
        ctx.solid(0.5, -2.6, 0.45, 0.25)
        for k in range(7):
            P('#C87A3A', rough=0.3, metal=1.0, flat=False).sphere((-3.4 + k * 1.1, -3.72, 2.3 + 0.2 * (k % 2)), (0.3, 0.12, 0.3), seg=10)
        P('#6A4A2E', rough=0.7).box((3.0, -3.0, 0.45), (2.4, 1.0, 0.9))   # the bench
        P('#C89A45', rough=0.3, metal=1.0).box((3.0, -3.0, 0.92), (2.3, 0.9, 0.04))
        ctx.solid(3.0, -3.0, 1.2, 0.5)
        ctx.solid(0, -4.6, 4.0, 0.8)
        ctx.light((3.0, -1.8, 2.4), 6.0, (14.0, 9.0, 4.0))
        ctx.points['bench'] = [3.0, -1.9]
        ctx.points['chest'] = [-3.0, 2.5]
        P.flush()


# ================================================================ al-Muizz Street
class Muizz:
    NAME, LANE = 'muizz', 7.0

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#3A322A').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#9A8C74').box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            for x in frange(x0 + 0.6, x1 - 0.6, 1.2):
                for y in frange(y0 + 0.9, y1 - 0.9, 1.8):
                    P(rnd.choice(['#B8A88C', '#AE9E82', '#C2B296'])).box((x, y, 0.03), (1.12, 1.72, 0.03))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        h = rnd.uniform(3.2, 3.8) if low else rnd.uniform(6.5, 8.0)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        # ablaq: courses of pale and dark stone
        course = 0.45
        k = 0
        z = 0.0
        while z < h - 1e-3:
            ch = min(course, h - z)
            P('#C8B89A' if k % 2 == 0 else '#7A5A44').box((cx, cy, z + ch / 2), (w, d, ch))
            z += ch
            k += 1
        # crenellations: stepped merlons along the top
        for s in sides:
            pts, n = face_points(x0, y0, x1, y1, s)
            horiz = s in ('N', 'S')
            for x in frange(x0 + 0.3, x1 - 0.3, 0.7) if horiz else frange(y0 + 0.3, y1 - 0.3, 0.7):
                px = x if horiz else (x1 - 0.2 if s == 'E' else x0 + 0.2)
                py = (y1 - 0.2 if s == 'N' else y0 + 0.2) if horiz else x
                P('#C8B89A').box((px, py, h + 0.25), (0.35 if horiz else 0.3, 0.3 if horiz else 0.35, 0.5))
            # a tall portal with a stepped (muqarnas) hood, and grilled windows
            if pts:
                px, py = pts[len(pts) // 2]
                P('#241A14').box((px + n[0] * 0.05, py + n[1] * 0.05, 1.6), (1.6 if horiz else 0.1, 0.1 if horiz else 1.6, 3.2))
                for k2 in range(4):
                    wk = 2.4 - k2 * 0.45
                    P('#D8C8A8').box((px + n[0] * (0.1 + k2 * 0.05), py + n[1] * (0.1 + k2 * 0.05), 3.3 + k2 * 0.22),
                                     (wk if horiz else 0.1, 0.1 if horiz else wk, 0.22))
                ctx.light((px + n[0] * 1.3, py + n[1] * 1.3, 3.0), 6.0, (13.0, 8.0, 3.2))
                P('#FFB04A', rough=0.3, emit=0.9).box((px + n[0] * 0.5, py + n[1] * 0.5, 3.0), (0.3, 0.3, 0.4))
            for (qx, qy) in pts[::2]:
                if h > 5:
                    P('#3A2A20', rough=0.5, metal=0.6).box((qx + n[0] * 0.06, qy + n[1] * 0.06, 4.8), (0.9 if horiz else 0.1, 0.1 if horiz else 0.9, 1.3))
        # a dome, or a minaret's upper storeys, on tall blocks well back from the street
        if not low and w > 4 and d > 4 and rnd.random() < 0.5:
            dp = Part()
            dome(dp, V((cx, cy, h)), min(w, d) * 0.3, drum_h=0.5)
            m.add(dp, '#B8A88C', rough=0.8)
        elif not low and rnd.random() < 0.35:
            tx, ty = cx + rnd.uniform(-w / 4, w / 4), cy + rnd.uniform(-d / 4, d / 4)
            for k2, (r, hh) in enumerate(((0.8, 2.4), (0.6, 1.8), (0.4, 1.2))):
                base = h + sum(x[1] for x in ((0.8, 2.4), (0.6, 1.8), (0.4, 1.2))[:k2])
                P('#C8B89A', flat=False).sloft([(V((tx, ty, base + z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z in (0.0, hh)], seg=8)
                P('#D8C8A8').box((tx, ty, base + hh), (r * 2.4, r * 2.4, 0.15))
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal':
            for (x, y) in rnd.sample(junction_corners(lanes, 0.5), 2):
                P('#8A7C68').box((x, y, 0.35), (0.35, 0.35, 0.7))   # a stone bollard
                ctx.solid(x, y, 0.2, 0.2)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        l = Muizz.LANE / 2
        for sx in (-1, 1):
            P('#B8A88C').box((sx * (l + 0.5), -7.2, 2.6), (1.0, 1.2, 5.2))
            ctx.solid(sx * (l + 0.5), -7.2, 0.5, 0.6)
            post_lamp(P, ctx, sx * (l - 0.5), -5.6, h=3.6, color='#FFB04A', light=(14.0, 8.0, 3.0))
        P('#C8B89A').box((0, -7.2, 5.0), (Muizz.LANE + 2.0, 1.2, 0.6))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # a court before a great portal: a stepped hood, bronze doors, braziers either side
        P('#7A5A44').box((0, 6.4, 3.4), (7.0, 1.0, 6.8))
        P('#5A3A22', rough=0.4, metal=0.7).box((0, 5.88, 1.8), (2.4, 0.06, 3.6))
        for k in range(5):
            P('#D8C8A8').box((0, 5.85 - k * 0.04, 4.0 + k * 0.3), (3.6 - k * 0.6, 0.1, 0.3))
        ctx.solid(0, 6.4, 3.5, 0.5)
        for x in (-3.8, 3.8):
            P('#3A3230', metal=0.3, flat=False).sloft([(V((x, 4.2, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((0, 0.3), (0.9, 0.22), (1.1, 0.35))], seg=10)
            P('#FF6A20', rough=0.5, emit=1.0, flat=False).sphere((x, 4.2, 1.25), (0.25, 0.25, 0.18), seg=8)
            ctx.light((x, 4.2, 1.8), 8.0, (18.0, 8.0, 2.4))
            ctx.solid(x, 4.2, 0.3, 0.3)
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # a sabil-kuttab: a fountain house with bronze grilles below and a loggia above, and a basin in front
        P('#C8B89A').box((0, -4.8, 2.8), (6.0, 2.0, 5.6))
        for x in (-1.6, 0, 1.6):
            P('#6A4A2A', rough=0.4, metal=0.8).box((x, -3.78, 1.3), (1.1, 0.06, 1.6))
        for x in (-2.0, -0.7, 0.7, 2.0):
            P('#7A5A44').box((x, -3.8, 4.4), (0.2, 0.2, 1.8))
        P('#FFC060', rough=0.4, emit=0.4).box((0, -3.9, 4.4), (5.0, 0.05, 1.6))
        ctx.solid(0, -4.8, 3.0, 1.0)
        P('#9A8A74', flat=False).sloft([(V((0, -1.8, z)), V((1, -0, 0)), V((0, -1, 0)), r, r) for z, r in ((0, 0.9), (0.55, 0.9), (0.6, 1.0))], seg=8)
        P('#2A4A50', rough=0.1).box((0, -1.8, 0.5), (1.3, 1.3, 0.04))
        ctx.solid(0, -1.8, 0.85, 0.85)
        ctx.light((0, -2.4, 3.6), 9.0, (16.0, 10.0, 4.0))
        ctx.points['chest'] = [3.4, -1.6]
        P.flush()


# ================================================================ the Mokattam cliffs
class Mokattam:
    NAME, LANE = 'mokattam', 6.4
    ROCK = ['#C4B8A0', '#B0A48C', '#9E927C', '#BAAE94']

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#6E6454').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#A89C86', rough=0.98).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            for k in range(int((x1 - x0) * (y1 - y0) / 4)):
                px, py = rnd.uniform(x0, x1), rnd.uniform(y0, y1)
                s = rnd.uniform(0.15, 0.45)
                P(rnd.choice(Mokattam.ROCK)).box((px, py, s * 0.3), (s, s * 0.8, s * 0.6), Matrix.Rotation(rnd.uniform(0, 3), 4, 'Z'))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        # quarried terraces: two or three shrinking steps, cut square
        tiers = 1 if low else rnd.randint(2, 3)
        z = 0.0
        for t in range(tiers):
            hh = rnd.uniform(1.6, 2.4) if low else rnd.uniform(2.0, 3.2)
            k = 1.0 - t * 0.22
            P(Mokattam.ROCK[t % 4]).box((cx + rnd.uniform(-0.3, 0.3) * t, cy + rnd.uniform(-0.3, 0.3) * t, z + hh / 2), (w * k, d * k, hh))
            z += hh
        for k in range(rnd.randint(1, 3)):   # scrub on top
            P('#3A4A2A', rough=0.95, flat=False).sphere((cx + rnd.uniform(-w / 4, w / 4), cy + rnd.uniform(-d / 4, d / 4), z + 0.2), 0.45, seg=6)
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        for (x, y) in rnd.sample(junction_corners(lanes, 0.6), 1 if kind == 'normal' else 0):
            # a fire burning in an oil drum
            P('#4A2E22', rough=0.5, metal=0.6, flat=False).sloft([(V((x, y, z)), V((1, 0, 0)), V((0, 1, 0)), 0.3, 0.3) for z in (0.0, 0.9)], seg=10)
            P('#FF7A20', rough=0.5, emit=1.0, flat=False).sphere((x, y, 1.0), (0.26, 0.26, 0.22), seg=8)
            ctx.light((x, y, 1.6), 8.0, (18.0, 8.5, 2.6))
            ctx.solid(x, y, 0.32, 0.32)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        for k in range(5):   # a stair cut into the rock
            P('#B0A48C').box((0, -7.8 + k * 0.4, k * 0.12), (Mokattam.LANE - 0.6, 0.4, 0.24))
        for sx in (-1, 1):
            P('#9E927C').box((sx * (Mokattam.LANE / 2 + 0.8), -7.0, 1.6), (1.6, 2.0, 3.2))
            ctx.solid(sx * (Mokattam.LANE / 2 + 0.8), -7.0, 0.8, 1.0)
        ctx.light((0, -5.6, 2.2), 7.0, (10.0, 8.0, 6.0))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # a quarry bowl ringed with fallen blocks and two fires
        for k in range(12):
            a = TAU * k / 12
            x, y = math.cos(a) * 5.9, math.sin(a) * 5.9
            if y < -4.5 and abs(x) < 3.5:
                continue
            s = rnd.uniform(0.7, 1.2)
            P(rnd.choice(Mokattam.ROCK)).box((x, y, s / 2), (s, s * 1.3, s), Matrix.Rotation(a, 4, 'Z'))
            ctx.solid(x, y, s * 0.55, s * 0.55)
        for x in (-4.0, 4.0):
            P('#FF7A20', rough=0.5, emit=1.0, flat=False).sphere((x, 3.2, 0.3), (0.5, 0.5, 0.35), seg=8)
            ctx.light((x, 3.2, 1.4), 9.0, (20.0, 9.0, 3.0))
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # a radio mast with a guard hut; its red warning light still blinks
        for k in range(8):
            z = k * 1.2
            r = 0.9 - k * 0.09
            for (sx, sy) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                P('#8A8A90', rough=0.4, metal=0.9).box((sx * r * 0.7, -3.6 + sy * r * 0.7, z + 0.6), (0.08, 0.08, 1.2))
            P('#8A8A90', rough=0.4, metal=0.9).box((0, -3.6, z + 1.2), (r * 1.5, r * 1.5, 0.06))
        P('#FF2020', rough=0.3, emit=1.0).box((0, -3.6, 9.8), (0.3, 0.3, 0.3))
        ctx.light((0, -3.6, 9.4), 12.0, (20.0, 1.5, 1.5))
        ctx.solid(0, -3.6, 0.8, 0.8)
        P('#8A7E6C').box((-3.6, -3.4, 1.2), (2.4, 2.0, 2.4))
        P('#FFB060', rough=0.5, emit=0.4).box((-3.6, -2.38, 1.2), (0.8, 0.05, 0.8))
        ctx.solid(-3.6, -3.4, 1.2, 1.0)
        ctx.light((-3.6, -1.8, 1.8), 6.0, (12.0, 7.0, 3.0))
        ctx.points['chest'] = [2.6, 1.5]
        P.flush()


# ================================================================ Bab Zuweila: the first trial
class Gate:
    NAME, LANE = 'gate', 6.0

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
            for x in frange(x0 + 0.5, x1 - 0.5, 1.0):
                for y in frange(y0 + 0.5, y1 - 0.5, 1.0):
                    if rnd.random() < 0.6:
                        P(rnd.choice(['#7A6E5E', '#827462', '#6E6252'])).box((x, y, 0.03), (0.94, 0.94, 0.03))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        h = rnd.uniform(3.0, 3.6) if low else rnd.uniform(6.0, 7.5)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        P('#A8946E').box((cx, cy, h / 2), (w, d, h))
        for s in sides:   # arrow slits, and torches burning jinn-green
            pts, n = face_points(x0, y0, x1, y1, s)
            horiz = s in ('N', 'S')
            for i, (px, py) in enumerate(pts):
                P('#1A1410').box((px + n[0] * 0.04, py + n[1] * 0.04, min(h - 0.8, 3.0)), (0.2 if horiz else 0.08, 0.08 if horiz else 0.2, 1.2))
                if i % 2 == 1:
                    P('#2A2420', metal=0.5).box((px + n[0] * 0.3, py + n[1] * 0.3, 2.2), (0.12, 0.12, 0.5))
                    P('#5AFF9A', rough=0.4, emit=1.0, flat=False).sphere((px + n[0] * 0.3, py + n[1] * 0.3, 2.55), (0.12, 0.12, 0.18), seg=6)
                    ctx.light((px + n[0] * 0.9, py + n[1] * 0.9, 2.4), 5.0, (5.0, 14.0, 8.0))
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        pass

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        # the gate: two round towers flanking the passage, each crowned with a slender tower
        for sx in (-1, 1):
            x = sx * 4.6
            P('#B8A47E', flat=False).sloft([(V((x, -5.6, z)), V((1, 0, 0)), V((0, 1, 0)), 1.7, 1.7) for z in (0.0, 7.0)], seg=16)
            P('#C8B48E').box((x, -5.6, 7.2), (3.6, 3.6, 0.4))
            for k2, (r, hh) in enumerate(((0.55, 2.2), (0.4, 1.6))):
                base = 7.4 + (2.2 if k2 else 0)
                P('#C8B48E', flat=False).sloft([(V((x, -5.6, base + z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z in (0.0, hh)], seg=8)
            ctx.solid(x, -5.6, 1.7, 1.7)
        P('#B8A47E').box((0, -5.6, 6.0), (6.0, 2.0, 2.0))
        ctx.light((0, -4.2, 3.0), 8.0, (6.0, 16.0, 9.0))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # the ifrit's hall: a ring of chains fixed to posts round a great iron brazier
        for k in range(8):
            a = TAU * k / 8 + 0.2
            x, y = math.cos(a) * 5.6, math.sin(a) * 5.6
            if y < -4.5 and abs(x) < 3.0:
                continue
            P('#3A3430', metal=0.7).box((x, y, 1.0), (0.3, 0.3, 2.0))
            ctx.solid(x, y, 0.2, 0.2)
        P('#2A2420', metal=0.6, flat=False).sloft([(V((0, 4.0, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((0, 0.6), (1.0, 0.45), (1.3, 0.8))], seg=12)
        P('#FF5A10', rough=0.5, emit=1.0, flat=False).sphere((0, 4.0, 1.5), (0.6, 0.6, 0.4), seg=10)
        ctx.light((0, 4.0, 2.2), 12.0, (24.0, 9.0, 2.0))
        ctx.solid(0, 4.0, 0.6, 0.6)
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        Gate.arena(m, rnd, ctx)
        ctx.points['chest'] = [3.0, -2.0]


REGIONS = [Downtown, Metro, Khan, Muizz, Mokattam, Gate]
