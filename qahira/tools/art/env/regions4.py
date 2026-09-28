"""Act IV's regions for the cell kit (env/kit.py): the Maghreb Coast.

  ghadames  Ghadames' old town: whitewashed mud houses with triangular crenellations, lanes roofed with palm-trunk
            beams and lit by shafts, red and green triangles painted round the doors
  chott     the Chott el-Djerid: a salt lake's crust cracked into polygons, pools of pink brine, mounds of dug salt,
            a raised causeway, the salt cutters' frond shelters
  tozeur    Tozeur's old quarter: walls of buff brick laid in raised diamonds and chevrons, palm groves with their
            channels, date crates
  medina    the Tunis medina: whitewashed walls, studded doors in green and blue, tile skirts, souq vaults hung with
            lanterns, a chechia maker's red caps

No mosque stands in any of them (brief.md §5): the medina's lanes and souqs, its houses and courtyards only.
Blocks south of a lane stay low (the camera looks north over them); blocks north of it may be tall.
"""
import math
from mathutils import Vector as V, Matrix

from qart.geom import TAU
from env.regions import Paint, post_lamp, face_points, frange, junction_corners


def rotz(a):
    return Matrix.Rotation(a, 4, 'Z')


def crenels(P, cx, cy, w, d, h, col, step=0.5):
    """Triangular merlons along a roof's edge (Ghadames' and the Nafusa's houses)."""
    for s in (-1, 1):
        for x in frange(cx - w / 2 + step / 2, cx + w / 2 - step / 2, step):
            P(col).box((x, cy + s * (d / 2 - 0.05), h + 0.14), (0.16, 0.1, 0.28), Matrix.Rotation(math.radians(45), 4, 'Y'))
        for y in frange(cy - d / 2 + step / 2, cy + d / 2 - step / 2, step):
            P(col).box((cx + s * (w / 2 - 0.05), y, h + 0.14), (0.1, 0.16, 0.28), Matrix.Rotation(math.radians(45), 4, 'X'))


def door(P, px, py, n, horiz, col, frame=None, z=1.1, w=0.9, h=2.2):
    """A door set into a wall face, with a painted frame if asked."""
    if frame:
        P(frame).box((px + n[0] * 0.03, py + n[1] * 0.03, z + 0.1), (w + 0.3 if horiz else 0.06, 0.06 if horiz else w + 0.3, h + 0.3))
    P(col).box((px + n[0] * 0.06, py + n[1] * 0.06, z), (w if horiz else 0.06, 0.06 if horiz else w, h))


# ================================================================ Ghadames
class Ghadames:
    NAME, LANE = 'ghadames', 4.8
    WHITE = ['#E8E2D6', '#F0EAE0', '#DCD4C6']

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#A8987C').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#C8B898', rough=0.98).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            # palm-trunk beams across the lane overhead, and the light falling between them
            horiz = (x1 - x0) > (y1 - y0)
            if horiz:
                for x in frange(x0 + 1.0, x1 - 1.0, 2.6):
                    P('#6A5238', flat=False).capsule(V((x, y0 - 0.3, 3.3)), V((x, y1 + 0.3, 3.3)), 0.1, seg=6)
            else:
                for y in frange(y0 + 1.0, y1 - 1.0, 2.6):
                    P('#6A5238', flat=False).capsule(V((x0 - 0.3, y, 3.3)), V((x1 + 0.3, y, 3.3)), 0.1, seg=6)
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        h = rnd.uniform(2.4, 3.0) if low else rnd.uniform(4.2, 6.0)
        col = rnd.choice(Ghadames.WHITE)
        P(col).box((cx, cy, h / 2), (w, d, h))
        crenels(P, cx, cy, w, d, h, col)
        for s in sides:
            pts, n = face_points(x0, y0, x1, y1, s)
            horiz = s in ('N', 'S')
            for i, (px, py) in enumerate(pts):
                if i % 3 == 0:
                    # a palm-wood door with red and green triangles painted round it
                    door(P, px, py, n, horiz, '#6A4A30')
                    for k in range(5):
                        off = (k - 2) * 0.24
                        P('#B83A2A' if k % 2 else '#2E7A4A').box(
                            (px + (off if horiz else 0) + n[0] * 0.04, py + (0 if horiz else off) + n[1] * 0.04, 2.45),
                            (0.14 if horiz else 0.04, 0.04 if horiz else 0.14, 0.14), Matrix.Rotation(math.radians(45), 4, 'Y' if horiz else 'X'))
                elif i % 3 == 2 and rnd.random() < 0.4:
                    P('#FFC070', rough=0.3, emit=0.9).box((px + n[0] * 0.06, py + n[1] * 0.06, 2.6), (0.3 if horiz else 0.05, 0.05 if horiz else 0.3, 0.3))
                    ctx.light((px + n[0] * 1.0, py + n[1] * 1.0, 2.4), 5.0, (12.0, 8.0, 3.6))
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal' and rnd.random() < 0.7:
            (x, y) = rnd.choice(junction_corners(lanes, 0.5))
            # a mastaba bench of whitewashed mud, and a water jar on it
            P('#E0D8CA').box((x, y, 0.25), (1.2, 0.5, 0.5))
            P('#A86A44', flat=False).sphere((x + 0.3, y, 0.72), (0.18, 0.18, 0.22), seg=8)
            ctx.solid(x, y, 0.6, 0.25)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        for sx in (-1, 1):   # the town gate: two thick white piers and a beam of palm
            x = sx * (Ghadames.LANE / 2 + 0.7)
            P('#E8E2D6').box((x, -7.0, 1.9), (1.4, 1.6, 3.8))
            crenels(P, x, -7.0, 1.4, 1.6, 3.8, '#E8E2D6', step=0.45)
            ctx.solid(x, -7.0, 0.7, 0.8)
        P('#6A5238', flat=False).capsule(V((-Ghadames.LANE / 2 - 1.2, -7.0, 3.5)), V((Ghadames.LANE / 2 + 1.2, -7.0, 3.5)), 0.16, seg=6)
        post_lamp(P, ctx, Ghadames.LANE / 2 - 0.4, -5.2, h=2.8, color='#FFC070', light=(12.0, 8.0, 3.4))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # the spring's square: the old stone basin fed by a channel, and the houses leaning over it
        P('#B8A888').box((0, 3.6, 0.25), (5.0, 3.0, 0.5))
        P('#3A8A8E', rough=0.05, metal=0.3, emit=0.12).box((0, 3.6, 0.52), (4.4, 2.4, 0.02))
        P('#B8A888').box((0, 6.2, 0.15), (0.6, 2.2, 0.3))
        ctx.solid(0, 3.6, 2.5, 1.5)
        for x in (-3.6, 3.6):
            post_lamp(P, ctx, x, 1.4, h=2.8, color='#FFC070', light=(13.0, 8.5, 3.6))
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # a house's open upper room seen through its fallen wall: rugs, cushions, brass and mirrors (to the south)
        P('#E8E2D6').box((0, -4.6, 1.2), (5.0, 2.4, 2.4))
        crenels(P, 0, -4.6, 5.0, 2.4, 2.4, '#E8E2D6')
        P('#8A2A26').box((0, -3.3, 0.02), (3.2, 1.4, 0.02))
        for x in (-1.2, 0.0, 1.2):
            P('#C89A45', metal=1.0, rough=0.3, flat=False).sphere((x, -3.5, 2.0), (0.2, 0.05, 0.2), seg=8)
        ctx.solid(0, -4.6, 2.5, 1.2)
        ctx.light((0, -2.6, 2.4), 7.0, (13.0, 8.0, 3.0))
        ctx.points['chest'] = [2.8, -1.8]
        P.flush()


# ================================================================ the Chott el-Djerid
class Chott:
    NAME, LANE = 'chott', 6.6

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#C8BEB4').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#E8E2DA', rough=0.9).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            # the crust's polygons: raised white ridges on the pale grey
            for k in range(int((x1 - x0) * (y1 - y0) / 2.5)):
                px, py = rnd.uniform(x0 + 0.2, x1 - 0.2), rnd.uniform(y0 + 0.2, y1 - 0.2)
                a = rnd.uniform(0, TAU)
                P('#F6F2EC', rough=0.7).box((px, py, 0.03), (rnd.uniform(0.6, 1.4), 0.05, 0.03), rotz(a))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        if rnd.random() < 0.6:
            # a pool of pink brine, its rim crusted white
            P('#F2EEE6').box((cx, cy, 0.12), (w, d, 0.24))
            P('#D88A9A', rough=0.08, metal=0.2, emit=0.08).box((cx, cy, 0.25), (w - 0.5, d - 0.5, 0.02))
            for k in range(3 if low else 6):
                px, py = rnd.uniform(x0 + 0.5, x1 - 0.5), rnd.uniform(y0 + 0.5, y1 - 0.5)
                P('#FFFFFF', rough=0.5).box((px, py, 0.28), (rnd.uniform(0.2, 0.5), rnd.uniform(0.2, 0.5), 0.06), rotz(rnd.uniform(0, 3)))
        else:
            # mounds of dug salt, and a salt cutter's shelter of palm fronds on poles
            for k in range(2 if low else rnd.randint(3, 5)):
                px, py = rnd.uniform(x0 + 0.8, x1 - 0.8), rnd.uniform(y0 + 0.8, y1 - 0.8)
                r = rnd.uniform(0.6, 1.1)
                P('#F4F0EA', flat=False).sloft([(V((px, py, z)), V((1, 0, 0)), V((0, 1, 0)), rr, rr) for z, rr in ((0, r), (r * 0.9, r * 0.5),
                                                                                                                 (r * 1.4, 0.05))], seg=10)
            if not low and w > 3 and d > 3:
                for (sx, sy) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
                    P('#6A5238', flat=False).capsule(V((cx + sx * 1.0, cy + sy * 0.8, 0)), V((cx + sx * 1.0, cy + sy * 0.8, 2.2)), 0.05, seg=5)
                P('#8A7A4A', rough=0.95).box((cx, cy, 2.25), (2.4, 2.0, 0.1))
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal' and rnd.random() < 0.5:
            (x, y) = rnd.choice(junction_corners(lanes, 0.6))
            # a marker post of the causeway, painted in bands
            for k in range(4):
                P('#D84A3A' if k % 2 else '#F0ECE6').box((x, y, 0.3 + 0.3 * k), (0.14, 0.14, 0.3))
            ctx.solid(x, y, 0.1, 0.1)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        # the causeway's roadside stand: a shed of reed matting, crates of salt roses, a lamp
        P('#8A7A4A').box((-3.6, -6.6, 1.1), (2.0, 1.6, 2.2))
        for k in range(4):
            P('#E8C8B8', flat=False).sphere((-3.0 + 0.3 * k, -5.6, 0.4), (0.14, 0.14, 0.1), seg=6)
        ctx.solid(-3.6, -6.6, 1.0, 0.8)
        post_lamp(P, ctx, 3.4, -5.4, h=2.8, color='#FFD8B0', light=(13.0, 10.0, 7.0))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # the lake's heart: a ring of salt crystals as tall as a man round an open pan, pink water beyond
        for k in range(10):
            a = TAU * k / 10
            x, y = math.cos(a) * 6.2, math.sin(a) * 6.2
            if y < -4.5 and abs(x) < 3.0:
                continue
            h = rnd.uniform(1.4, 2.6)
            P('#FAF6F0', rough=0.25, flat=False).sloft([(V((x, y, z)), V((1, 0, 0)), V((0, 1, 0)), r, r * 0.7)
                                                        for z, r in ((0, 0.45), (h * 0.7, 0.3), (h, 0.02))], seg=6, p=1.0)
            ctx.solid(x, y, 0.4, 0.4)
        P('#D88A9A', rough=0.08, metal=0.2, emit=0.08).box((0, 7.6, 0.02), (14.0, 1.4, 0.02))
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # an abandoned salt works: a rusted conveyor over a mound (to the south: the way in is north)
        P('#F4F0EA', flat=False).sloft([(V((0, -4.6, z)), V((1, 0, 0)), V((0, 1, 0)), r, r * 0.7) for z, r in ((0, 2.6), (1.4, 1.6), (2.4, 0.1))],
                                      seg=12)
        P('#7A4A32', metal=0.6, rough=0.7).box((1.8, -4.0, 1.8), (0.4, 4.0, 0.2), Matrix.Rotation(math.radians(25), 4, 'X'))
        ctx.solid(0, -4.6, 2.6, 1.8)
        ctx.points['chest'] = [3.2, -2.0]
        P.flush()


# ================================================================ Tozeur
class Tozeur:
    NAME, LANE = 'tozeur', 5.2
    BRICK = ['#C8A478', '#BC9868', '#D0AC80']

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#8A7454').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#B09470', rough=0.95).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            for x in frange(x0 + 0.3, x1 - 0.3, 0.6):   # a paving of brick in herringbone, roughly
                for y in frange(y0 + 0.3, y1 - 0.3, 0.6):
                    if rnd.random() < 0.35:
                        P(rnd.choice(Tozeur.BRICK)).box((x, y, 0.025), (0.5, 0.22, 0.02), rotz(math.radians(45 if (int(x * 3) + int(y * 3)) % 2 else -45)))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        if rnd.random() < 0.3:
            # a palm grove with its irrigation channels, behind a low brick wall
            P('#3A4A26', rough=0.95).box((cx, cy, 0.2), (w - 0.3, d - 0.3, 0.4))
            P('#3A6A6E', rough=0.1, metal=0.3).box((cx, cy, 0.42), (w - 0.6, 0.3, 0.02))
            from env.regions2 import palm
            for k in range(1 if low else rnd.randint(2, 4)):
                palm(P, rnd.uniform(x0 + 0.7, x1 - 0.7), rnd.uniform(y0 + 0.7, y1 - 0.7), 3.0 if low else rnd.uniform(5.5, 8.0), rnd)
        else:
            h = rnd.uniform(2.4, 3.0) if low else rnd.uniform(4.0, 6.5)
            col = rnd.choice(Tozeur.BRICK)
            P(col).box((cx, cy, h / 2), (w, d, h))
            for s in sides:   # bands of brick laid in raised diamonds and chevrons
                pts, n = face_points(x0, y0, x1, y1, s)
                horiz = s in ('N', 'S')
                for z in (1.4, 2.2) if low else (1.4, 2.2, 3.2):
                    for (px, py) in pts:
                        for k in (-1, 0, 1):
                            off = k * 0.32
                            P('#E0BC8C').box((px + (off if horiz else 0) + n[0] * 0.04, py + (0 if horiz else off) + n[1] * 0.04, z),
                                             (0.16 if horiz else 0.05, 0.05 if horiz else 0.16, 0.16),
                                             Matrix.Rotation(math.radians(45), 4, 'Y' if horiz else 'X'))
                for i, (px, py) in enumerate(pts):
                    if i % 3 == 1:
                        door(P, px, py, n, horiz, '#3A5A7A' if rnd.random() < 0.5 else '#5A3A2A', frame='#E0BC8C', z=0.95, h=1.9)
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal' and rnd.random() < 0.6:
            (x, y) = rnd.choice(junction_corners(lanes, 0.6))
            # crates of dates stacked for the morning
            for k in range(3):
                P('#8A6A44').box((x, y, 0.18 + 0.36 * k), (0.8, 0.5, 0.34))
                P('#6A2A16').box((x, y, 0.33 + 0.36 * k), (0.72, 0.42, 0.04))
            ctx.solid(x, y, 0.4, 0.25)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        for sx in (-1, 1):   # the quarter's gate: brick piers with the diamond bands, an arch between
            x = sx * (Tozeur.LANE / 2 + 0.7)
            P('#C8A478').box((x, -7.0, 2.2), (1.4, 1.4, 4.4))
            ctx.solid(x, -7.0, 0.7, 0.7)
        P('#C8A478', flat=False).sloft([(V((0, -7.0 + dy, 4.2)), V((1, 0, 0)), V((0, 0, 1)), Tozeur.LANE / 2 + 0.6, 0.9) for dy in (-0.6, 0.6)],
                                      seg=16, a0=0, a1=math.pi, closed=False)
        post_lamp(P, ctx, Tozeur.LANE / 2 - 0.4, -5.2, h=2.8, color='#FFC070', light=(12.0, 8.0, 3.4))
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # a clearing in the palm grove where the channels meet at a stone divider
        from env.regions2 import palm
        for k in range(9):
            a = TAU * k / 9 + 0.3
            x, y = math.cos(a) * 6.4, math.sin(a) * 6.4
            if y < -4.5 and abs(x) < 3.0:
                continue
            palm(P, x, y, rnd.uniform(6.0, 8.5), rnd)
            ctx.solid(x, y, 0.3, 0.3)
        P('#8A7A64').box((0, 3.4, 0.2), (1.6, 1.6, 0.4))
        for a in (0, math.pi / 2, math.pi):
            P('#3A6A6E', rough=0.1, metal=0.3).box((math.cos(a) * 2.2, 3.4 + math.sin(a) * 2.2, 0.02), (3.0 if a != math.pi / 2 else 0.3,
                                                                                                   0.3 if a != math.pi / 2 else 3.0, 0.02))
        ctx.solid(0, 3.4, 0.8, 0.8)
        for x in (-3.4, 3.4):
            post_lamp(P, ctx, x, 1.0, h=2.8, color='#FFC070', light=(12.0, 8.0, 3.4))
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # the finest facade of the quarter, the whole wall worked in brick relief (to the south)
        P('#C8A478').box((0, -4.8, 2.4), (6.0, 1.2, 4.8))
        for z in frange(0.8, 4.4, 0.45):
            for x in frange(-2.7, 2.7, 0.45):
                P('#E0BC8C').box((x, -4.18, z), (0.18, 0.05, 0.18), Matrix.Rotation(math.radians(45), 4, 'Y'))
        ctx.solid(0, -4.8, 3.0, 0.6)
        ctx.light((0, -2.8, 3.0), 8.0, (13.0, 8.5, 3.6))
        ctx.points['chest'] = [3.2, -2.2]
        P.flush()


# ================================================================ the Tunis medina
class Medina:
    NAME, LANE = 'medina', 4.6
    DOORS = ['#2E6A4A', '#2E5A8A', '#E0C878', '#7A2A26']

    @staticmethod
    def ground(m, rnd):
        P = Paint(m)
        P('#8A8474').box((0, 0, -0.05), (16, 16, 0.1))
        P.flush()

    @staticmethod
    def lanes(m, rnd, rects):
        P = Paint(m)
        for (x0, y0, x1, y1) in rects:
            P('#A8A090', rough=0.9).box(((x0 + x1) / 2, (y0 + y1) / 2, 0.01), (x1 - x0, y1 - y0, 0.02))
            for x in frange(x0 + 0.4, x1 - 0.4, 0.8):   # worn paving slabs
                for y in frange(y0 + 0.4, y1 - 0.4, 0.8):
                    if rnd.random() < 0.4:
                        P(rnd.choice(['#B8B0A0', '#9C9484', '#C0B8A8'])).box((x, y, 0.025), (0.74, 0.74, 0.02))
        P.flush()

    @staticmethod
    def block(m, rnd, x0, y0, x1, y1, sides, ctx, low):
        P = Paint(m)
        w, d = x1 - x0, y1 - y0
        if w < 1.2 or d < 1.2:
            return
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        h = rnd.uniform(2.6, 3.2) if low else rnd.uniform(5.0, 7.5)
        P('#EEEAE2').box((cx, cy, h / 2), (w, d, h))
        P('#D8D2C6').box((cx, cy, h + 0.08), (w + 0.1, d + 0.1, 0.16))
        souq = not low and rnd.random() < 0.35
        for s in sides:
            pts, n = face_points(x0, y0, x1, y1, s)
            horiz = s in ('N', 'S')
            tile = '#2E6A8A' if rnd.random() < 0.5 else '#3A7A4A'
            for (px, py) in pts:   # a skirt of glazed tiles at the foot of the wall
                P(tile).box((px + n[0] * 0.02, py + n[1] * 0.02, 0.45), (1.0 if horiz else 0.04, 0.04 if horiz else 1.0, 0.9))
            for i, (px, py) in enumerate(pts):
                if i % 3 == 0:
                    # a studded door under a horseshoe of black and white stone
                    col = rnd.choice(Medina.DOORS)
                    door(P, px, py, n, horiz, col, frame='#2A2A2A', z=1.2, w=1.0, h=2.3)
                    for k in range(6):
                        for j in range(3):
                            P('#1A1A1A', metal=0.7, flat=False).sphere((px + ((j - 1) * 0.28 if horiz else 0) + n[0] * 0.1,
                                                                        py + (0 if horiz else (j - 1) * 0.28) + n[1] * 0.1, 0.35 + 0.35 * k),
                                                                       0.03, seg=4)
                elif souq and i % 3 == 1:
                    # a souq stall's shutter open, and its lantern
                    P('#6A4A30').box((px + n[0] * 0.25, py + n[1] * 0.25, 1.9), (1.2 if horiz else 0.5, 0.5 if horiz else 1.2, 0.08))
                    P('#FFB060', rough=0.3, emit=0.9, flat=False).sphere((px + n[0] * 0.4, py + n[1] * 0.4, 2.3), (0.12, 0.12, 0.16), seg=6)
                    ctx.light((px + n[0] * 1.0, py + n[1] * 1.0, 2.2), 5.0, (12.0, 7.5, 3.0))
                    for k in range(4):   # chechias: the red felt caps, stacked
                        P('#B82A2A', flat=False).sphere((px + n[0] * 0.3 + (k - 1.5) * 0.18 * (1 if horiz else 0),
                                                         py + n[1] * 0.3 + (k - 1.5) * 0.18 * (0 if horiz else 1), 1.05), (0.08, 0.08, 0.06), seg=6)
                elif rnd.random() < 0.3:
                    # a window with a turned-wood grille, painted like the doors
                    P(rnd.choice(Medina.DOORS)).box((px + n[0] * 0.05, py + n[1] * 0.05, 3.0), (0.7 if horiz else 0.08, 0.08 if horiz else 0.7, 0.9))
        ctx.solid(cx, cy, w / 2, d / 2)
        P.flush()

    @staticmethod
    def dress(m, rnd, lanes, ctx, kind):
        P = Paint(m)
        if kind == 'normal' and rnd.random() < 0.6:
            (x, y) = rnd.choice(junction_corners(lanes, 0.5))
            # a lantern hung on a bracket, and a pot of basil
            P('#1A1A1A', metal=0.6).box((x, y, 1.2), (0.06, 0.06, 2.4))
            P('#FFB060', rough=0.3, emit=0.9, flat=False).sphere((x, y, 2.5), (0.14, 0.14, 0.2), seg=6)
            P('#A86A44', flat=False).sphere((x + 0.3, y, 0.2), (0.16, 0.16, 0.2), seg=6)
            P('#3A6A2A', flat=False).sphere((x + 0.3, y, 0.45), (0.2, 0.2, 0.16), seg=6)
            ctx.light((x, y, 2.4), 5.0, (12.0, 7.5, 3.0))
            ctx.solid(x, y, 0.3, 0.2)
        P.flush()

    @staticmethod
    def entrance(m, rnd, ctx):
        P = Paint(m)
        # a gate of the old walls: a horseshoe arch in pale stone, a lantern either side
        for sx in (-1, 1):
            x = sx * (Medina.LANE / 2 + 0.8)
            P('#D8CCB0').box((x, -7.0, 2.4), (1.6, 1.6, 4.8))
            ctx.solid(x, -7.0, 0.8, 0.8)
            post_lamp(P, ctx, sx * (Medina.LANE / 2 - 0.4), -5.4, h=2.6, color='#FFB060', light=(11.0, 7.0, 2.8))
        P('#D8CCB0', flat=False).sloft([(V((0, -7.0 + dy, 4.0)), V((1, 0, 0)), V((0, 0, 1)), Medina.LANE / 2 + 0.8, 1.0) for dy in (-0.8, 0.8)],
                                      seg=18, a0=-0.3, a1=math.pi + 0.3, closed=False)
        P.flush()

    @staticmethod
    def arena(m, rnd, ctx):
        P = Paint(m)
        # a great house's courtyard: an arcade of slender columns, a marble fountain, tiles to shoulder height
        for k in range(10):
            a = TAU * k / 10 + 0.3
            x, y = math.cos(a) * 6.0, math.sin(a) * 6.0
            if y < -4.5 and abs(x) < 3.0:
                continue
            P('#F0ECE4', flat=False).capsule(V((x, y, 0)), V((x, y, 3.2)), 0.16, seg=8)
            P('#2E6A8A').box((x, y, 0.5), (0.4, 0.4, 1.0))
            ctx.solid(x, y, 0.25, 0.25)
        P('#F0ECE4', flat=False).sloft([(V((0, 1.8, z)), V((1, 0, 0)), V((0, 1, 0)), r, r) for z, r in ((0, 1.3), (0.5, 1.3), (0.55, 1.1))],
                                      seg=16)
        P('#6AAAB8', rough=0.05, metal=0.3, emit=0.1).box((0, 1.8, 0.52), (1.8, 1.8, 0.02))
        ctx.solid(0, 1.8, 1.3, 1.3)
        for x in (-3.4, 3.4):
            post_lamp(P, ctx, x, -1.0, h=2.6, color='#FFB060', light=(12.0, 7.5, 3.0))
        P.flush()

    @staticmethod
    def landmark(m, rnd, ctx):
        P = Paint(m)
        # the souq of the perfumers under its vault: shelves of glass flasks, a lamp in every niche (to the south)
        P('#EEEAE2').box((0, -4.8, 1.6), (6.0, 1.4, 3.2))
        P('#EEEAE2', flat=False).sloft([(V((0, -4.8 + dy, 3.2)), V((1, 0, 0)), V((0, 0, 1)), 3.0, 1.2) for dy in (-0.7, 0.7)], seg=16, a0=0,
                                      a1=math.pi, closed=False)
        for x in frange(-2.4, 2.4, 0.6):
            for z in (0.8, 1.4, 2.0):
                P(rnd.choice(['#6AA8D8', '#D8A86A', '#A86AD8', '#6AD8A8']), rough=0.1, emit=0.3, flat=False).sphere((x, -4.05, z), (0.08, 0.08, 0.12),
                                                                                                                    seg=6)
        ctx.solid(0, -4.8, 3.0, 0.7)
        ctx.light((0, -3.0, 2.4), 8.0, (12.0, 9.0, 6.0))
        ctx.points['chest'] = [3.2, -2.0]
        P.flush()


REGIONS = [Ghadames, Chott, Tozeur, Medina]
